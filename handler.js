const fs = require('fs')
const path = require('path')
const Promise = require('bluebird')
const _ = require('lodash')
const moment = require('moment')
const axios = require('axios')
const Gdax = require('./gdax-node')
const authedClient = new Gdax.AuthenticatedClient(process.env.GDAX_API_KEY, process.env.GDAX_API_SECRET, process.env.GDAX_PASSPHRASE, process.env.GDAX_URI)

module.exports.nanopoolScan = (event, context, callback) => {
  axios(`https://api.nanopool.org/v1/eth/paymentsday/${process.env.ETH_WALLET_ADDRESS}`)
    .then(({ data }) => {
      let payments = data.data
      if (payments.length) {
        let confirmedPayments = _.filter(payments, { confirmed: true })
        if (confirmedPayments.length) {
          Promise.map(confirmedPayments, (payment) => {
            let size = ((payment.amount / 100) * process.env.SELL_PERCENTAGE).toPrecision(2)
            let params = {
              type: 'market',
              'product_id': `ETH-${process.env.FIAT_TYPE}`,
              size
            }
            return authedClient.sell(params)
              .then((result) => {
                let symbol = process.env.FIAT_TYPE === 'EUR' ? '€' : (process.env.FIAT_TYPE === 'CNY' ? '¥' : (process.env.FIAT_TYPE === 'RUR' ? '₽' : '$'))
                console.log(`Successfully sold ${size} ETH: `, result)
                return authedClient.getPaymentMethods()
              })
              .then((paymentMethods) => {
                console.log('Payment Methods: ', paymentMethods)
                let paymentMethod = _.find(paymentMethods, { primary_buy: true })
                if (paymentMethod) {
                  return axios(`https://api.nanopool.org/v1/eth/prices`)
                    .then(({ data }) => {
                      let price = data.data[`price_${process.env.FIAT_TYPE.toLowerCase()}`]
                      return authedClient.withdrawToPaymentMethod({
                        amount: size * price,
                        currency: process.env.FIAT_TYPE,
                        'payment_method_id': paymentMethod.id
                      })
                    })
                } else throw new Error('No Payment ID')
              })
          })
            .then((results) => {
              console.log(results)
              callback(null, { statusCode: 200, body: results })
            })
        } else {
          console.log('No Confirmed Payments Found')
          callback(null, { statusCode: 404, body: 'No Confirmed Payments Found' })
        }
      } else {
        console.log('No Payments Found')
        callback(null, { statusCode: 404, body: 'No Payments Found' })
      }
    })
    .catch(callback)
}

module.exports.statusPage = (event, context, callback) => {
  Promise.all([
    axios(`https://api.nanopool.org/v1/eth/user/${process.env.ETH_WALLET_ADDRESS}`),
    axios(`https://api.nanopool.org/v1/eth/prices`),
    axios(`https://api.nanopool.org/v1/eth/paymentsday/${process.env.ETH_WALLET_ADDRESS}`),
    axios(`https://api.nanopool.org/v1/eth/usersettings/${process.env.ETH_WALLET_ADDRESS}`),
    axios(`https://api.nanopool.org/v1/eth/history/${process.env.ETH_WALLET_ADDRESS}`)
  ])
    .then((res) => {
      let stats = res[0].data.data
      let price = res[1].data.data[`price_${process.env.FIAT_TYPE.toLowerCase()}`]
      let payments = res[2].data.data || []
      let payout = (res[3].data.data).payout
      let history = _.map(res[4].data.data, (item) => {
        item.unix = item.date * 1000
        item.date = moment(item.date * 1000).format('MM/DD/YYYY hh:mm:ss a')
        return item
      })
      .sort(function (a, b) {
        return a.unix - b.unix
      })
      history = history.slice(history.length - 144)
      history.push({ unix: history[history.length - 1].unix, date: history[history.length - 1].date, hashrate: 0 })
      history[0] = { unix: history[0].unix, date: history[0].date, hashrate: 0 }
      let formattedHistory = JSON.stringify(history)
      let fiat = process.env.FIAT_TYPE === 'EUR' ? 'euros' : (process.env.FIAT_TYPE === 'CNY' ? 'yuan' : (process.env.FIAT_TYPE === 'RUR' ? 'rubles' : 'dollars'))
      let symbol = process.env.FIAT_TYPE === 'EUR' ? '€' : (process.env.FIAT_TYPE === 'CNY' ? '¥' : (process.env.FIAT_TYPE === 'RUR' ? '₽' : '$'))
      let totalPaid = Number(stats.balance)
      payments.forEach((payment) => {
        totalPaid += payment.amount
      })
      return axios(`https://api.nanopool.org/v1/eth/approximated_earnings/${stats.avgHashrate.h6}`)
        .then(({ data }) => {
          let approxEarnings = data.data
          let timeToEven = moment().to(moment().add(process.env.MINING_INVESTMENT / approxEarnings.day[fiat], 'days'))
          let body = `
<!doctype html>
<html>
  <head>
    <meta http-equiv="Content-Type" content="text/html; charset=utf-8" />
    <title>Mining Stats</title>
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/bulma/0.3.2/css/bulma.min.css">
  </head>
  <body class="section">
    <div class="container content">
      <h1 class="title"><strong>Total Revenue:</strong> ${symbol}${(totalPaid * price).toFixed(2)} (Ξ${totalPaid})</h1>
      <p><strong>ETH/${process.env.FIAT_TYPE} Price:</strong> ${symbol}${(price).toFixed(2)}</p>
      <p><strong>Unpaid Balance:</strong> ${symbol}${(stats.balance * price).toFixed(2)} (Ξ${stats.balance})</p>
      <p><strong>Next Payout:</strong> ${moment().add((payout - stats.balance) / approxEarnings.minute.coins, 'minutes').calendar()} (${moment().add((payout - stats.balance) / approxEarnings.minute.coins, 'minutes').fromNow()} - ${((stats.balance / payout) * 100).toFixed(1)}% complete)</p>
      <a href="https://eth.nanopool.org/account/${process.env.ETH_WALLET_ADDRESS}">Nanopool Dashboard</a> | <a href="${process.env.ETHOS_DASHBOARD}">EthOS Dashboard</a>
      <br />
      <hr />
      <h2 class="subtitle">Mining Investment</h2>
      <p><strong>Total Investment:</strong> ${symbol}${process.env.MINING_INVESTMENT}</p>
      <p><strong>Break Even:</strong> ${moment().add(process.env.MINING_INVESTMENT / approxEarnings.day[fiat], 'days').calendar()} (${timeToEven} - ${(((totalPaid * price) / process.env.MINING_INVESTMENT) * 100).toFixed(2)}% complete)</p>
      <p><strong>Daily Earnings:</strong> ${symbol}${(approxEarnings.day[fiat]).toFixed(2)} | <strong>Weekly Earnings:</strong> ${symbol}${(approxEarnings.week[fiat]).toFixed(2)} | <strong>Monthly Earnings:</strong> ${symbol}${(approxEarnings.month[fiat]).toFixed(2)}</p>
      <h2 class="subtitle">Hash Rate</h2>
      <svg id="hashrate" width="960" height="250"></svg>
      <p><strong>Current:</strong> ${stats.hashrate} MH/s</p>
      <p><strong>Average (24h):</strong> ${stats.avgHashrate.h24} MH/s</p>
      <h2 class="subtitle">Workers (${stats.workers.length})</h2>
      ${stats.workers.map((worker) => `<div>
        <p><strong>ID:</strong> ${worker.id}</p>
        <p><strong>Current Hash Rate:</strong> ${worker.hashrate}</p>
        <p><strong>Last Share:</strong> ${moment(worker.lastShare).fromNow()}</p>
      </div>`)}
      <h2 class="subtitle">Payments (${payments.length})</h2>
      ${payments.map((payment) => `<div>
        <p><strong>Date:</strong> ${moment(payment.date * 1000).calendar()}</p>
        <p><strong>txHash:</strong> ${payment.txHash}</p>
        <p><strong>Amount:</strong> Ξ${payment.amount.toFixed(5)} (${symbol}${(payment.amount * price).toFixed(2)})</p>
        <p><strong>Confirmed:</strong> ${payment.confirmed}</p>
      </div>`)}
    </div>
    <script src="https://d3js.org/d3.v4.min.js"></script>
    <script>
      var parseTime = d3.timeParse("%x %X");
      var data = (${formattedHistory})
        .map(function (item) {
          item.date = parseTime(item.date)
          return item
        })
      
      drawHashrate()

      function drawHashrate () {
        var svg = d3.select("#hashrate"),
          margin = {top: 20, right: 20, bottom: 30, left: 50},
          width = +svg.attr("width") - margin.left - margin.right,
          height = +svg.attr("height") - margin.top - margin.bottom,
          g = svg.append("g").attr("transform", "translate(" + margin.left + "," + margin.top + ")");

        var x = d3.scaleTime()
            .rangeRound([0, width]);

        var y = d3.scaleLinear()
            .rangeRound([height, 0]);

        var line = d3.line()
            .x(function(d) { return x(d.date); })
            .y(function(d) { return y(d.hashrate); });

        x.domain(d3.extent(data, function(d) {
          return d.date;
        }));
        y.domain(d3.extent(data, function(d) { return d.hashrate; }));

        g.append("g")
            .attr("transform", "translate(0," + height + ")")
            .call(d3.axisBottom(x))
            .select(".domain")
            .remove();

        g.append("g")
            .call(d3.axisLeft(y))
            .append("text")
            .attr("fill", "#000")
            .attr("transform", "rotate(-90)")
            .attr("y", 6)
            .attr("dy", "0.71em")
            .attr("text-anchor", "end")
            .text("Hashrate (MH/s)");

        g.append("path")
            .datum(data)
            .attr("fill", "purple")
            .attr("stroke", "purple")
            .attr("stroke-linejoin", "round")
            .attr("stroke-linecap", "round")
            .attr("stroke-width", 1.5)
            .attr("d", line);
      }
      
    </script>
  </body>
</html>`
          if (event === 'test') fs.writeFile('index.html', body, (err) => callback(null, { statusCode: 200 }))
          else {
            callback(null, {
              statusCode: 200,
              headers: {
                'Content-Type': 'text/html'
              },
              body
            })
          }
        })
    })
    .catch((err) => {
      callback(null, {
        statusCode: 200,
        headers: {
          'Content-Type': 'text/html'
        },
        body: `<!doctype html>
<html>
  <head>
    <meta http-equiv="Content-Type" content="text/html; charset=utf-8" />
    <title>Mining Stats</title>
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/bulma/0.3.2/css/bulma.min.css">
  </head>
  <body class="section">
    <div class="container content">
      <h1 class="title">Service is busy, check back in a few minutes.</h1>
    </div>
  </body>
</html>`
      })
    })
}
