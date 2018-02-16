# Ethaxe

Lambda functions for your Ethereum mining rig. 

Comes with a status page, and auto-sell automation. By using the nanopool and GDAX APIs, Ethaxe enables you to 'set and forget' your returns on your mining investment and have any USD sale funds deposited to your bank account. 

[![Donate with Bitcoin](https://en.cryptobadges.io/badge/micro/16Ui8XPa6c3Z2P6tRuWFesrAyppgNnZHQm)](https://en.cryptobadges.io/donate/16Ui8XPa6c3Z2P6tRuWFesrAyppgNnZHQm) [![Donate with Ethereum](https://en.cryptobadges.io/badge/micro/0x3fC09955c9fbFE0fE0AF39E0f1587370627ED77a)](https://en.cryptobadges.io/donate/0x3fC09955c9fbFE0fE0AF39E0f1587370627ED77a) [![Donate with Litecoin](https://en.cryptobadges.io/badge/micro/LLFnB7p173qGsH3U3EXuMYzGw5qv31rJxA)](https://en.cryptobadges.io/donate/LLFnB7p173qGsH3U3EXuMYzGw5qv31rJxA)

## Getting Started

Make sure you have [Serverless](https://serverless.com/framework/docs/providers/aws/guide/installation/) installed and your [AWS credentials are set up](https://serverless.com/framework/docs/providers/aws/guide/credentials/).

Next, clone the repo.

```
git clone git@github.com:alfonsogoberjr/ethaxe.git
cd ethaxe
```

### API Keys

If you haven't already, make sure you create [GDAX API](https://www.gdax.com/settings/api) keys.

Open up the file `credentials.example.json`. Replace the GDAX values with your credentials. 

Rename it to `credentials.json` and save. This file is listed in .gitignore so you don't have to worry about accidentally checking it in to Git.

### EthOS and Nanopool

You will need an Ethereum mining rig with [EthOS](http://ethosdistro.com/) installed, mining on [Nanopool](https://eth.nanopool.org/). 

Copy your ethOS Dashboard address and paste it into `credentials.json`. 

### Ethereum Wallet Address

You will of course need an Ethereum wallet address from GDAX. Open up your Deposit menu from the ETH dashboard, and copy/paste the deposit address GDAX gives you into `credentials.json`. 

You might notice that there is a different address each time you click "Deposit". Don't worry, all of those addresses are linked to your account permanently. 

### Mining Investment

If you'd like to keep track of how close your rig is to paying for itself, you can enter your total expenditure on your rig (you _are_ keeping track of this, aren't you?) into `credentials.json`. 

### Sell Percentage

This is the percentage of your mined Ethereum you'd like to auto-convert into USD when the payout is detected. 

You're all set! Now you're ready to deploy your functions. 

## Functions

### nanopoolScan

A scheduled function which will run once per day, checking nanopool's API for payments in the last 24 hours. If it finds one that's confirmed, it will sell a percentage of those funds and withdraw the USD into your bank account. 100% automated returns from your rig. 

### statusPage

A handy status page for your overall mining financials. Calculates ROI and notes how much time you have left until your rig(s) pays for itself. 

## Deploy 

Just run

```
yarn build && yarn deploy
```

In the output you will see

```
endpoints:
  GET - https://xxxxxxxxxx.execute-api.us-east-1.amazonaws.com/prod/
```

Open that URL in a browser to see your new stats page. Bookmark it, share it, refresh it constantly on your phone while riding the subway, etc. 

## Test

```
yarn test
open file://$(pwd)/index.html
```
