# Frequently asked questions

- [What is LNP2Pbot?](#what-is-lnp2pbot)
- [What is Lightning Network?](#what-is-lightning-network)
- [What do I need to use LNP2Pbot?](#what-do-i-need-to-use-lnp2pbot)
- [How do I initialize the bot?](#how-do-i-initialize-the-bot)
- [What are the channels to make exchanges on Telegram?](#what-are-the-channels-to-make-exchanges-on-telegram)
- [Do I need to fill out any user registration or identity verification?](#do-i-need-to-fill-out-any-user-registration-or-identity-verification)
- [What type of information do you collect from each user?](#what-type-of-information-do-you-collect-from-each-user)
- [How does the user reputation system work?](#how-does-the-user-reputation-system-work)
- [How do I create a purchase order?](#how-do-i-create-a-purchase-order)
- [How do I create a sell order?](#how-do-i-create-a-sell-order)
- [How do I find and accept an offer to buy or sell?](#how-do-i-find-and-accept-an-offer-to-buy-or-sell)
- [How do I cancel a posted order?](#how-do-i-cancel-a-posted-order)
- [Are there minimum or maximum limits on the amounts I can trade?](#are-there-minimum-or-maximum-limits-on-the-amounts-i-can-trade)
- [How long does it take to finalize a transaction?](#how-long-does-it-take-to-finalize-a-transaction)
- [Fees and commissions?](#fees-and-commissions)
- [What exchange rate does the bot use?](#what-exchange-rate-does-the-bot-use)
- [In which countries is it available?](#in-which-countries-is-it-available)
- [Recommended Wallets](#recommended-wallets)
- [Support](#support)
- [Contact with developers](#contact-with-developers)
- [I am a developer and I want to contribute](#i-am-a-developer-and-i-want-to-contribute)

## What is LNP2Pbot?

LNP2PBOT is an open source, non-custodial peer-to-peer exchange with no user registration or identity verification, running on top of a Telegram bot and allowing you to buy and sell sats (minimum fractional unit of measurement of Bitcoin) via Lighting Network.


## What is Lightning Network?

Lighting Network is a network of payment channels that works as a second layer protocol on the Bitcoin network, taking advantage of the property of writing smart contracts on its blockchain. It is a scalability solution that allows exponentially increasing the number of transactions and their speed by not needing on-chain confirmations, while drastically reducing network fees. Payments become instant and cost almost nothing.


## What do I need to use LNP2Pbot?

You only need a Telegram account with the "username" activated, initialize the bot and a Wallet that supports Lighting Network (Here we leave you some suggestions LINK TO FAQ MEANS OF PAYMENT AND RECOMMENDED WALLETS).

## How do I initialize the bot?

Write privately to [@lnp2pbot](https://t.me/lnp2pbot) and run the `/start` command.

## What are the channels to make exchanges on Telegram?

To create your buy / sell orders write to [@lnp2pbot](https://t.me/lnp2pbot).

To take buy / sell offers, go to the channel [@p2plightning](https://t.me/p2plightning).

## Do I need to fill out any user registration or identity verification?

NOT! Bitcoin was born as "a person-to-person electronic money system" and we are proud to support that principle. No personal information is required from you, the exchanges are entirely between peers and LNP2PBot does not collect or store any personal information of the parties involved.

## What type of information do you collect from each user?

For the purposes of the user reputation system, only the number of completed transactions, the total volume traded, the counterparty rating, and the dispute score, if any. Of this information, only the number of transactions and the counterparty rating are public by default, and optional (you choose to show it or not, by default it is not shown) the total volume traded and your username.

In case you want to show your username and/or volume traded to accompany your reputation in the offers you publish, you must do it manually through the following commands:
```
/show username yes

/showvolume yes
```
Each command is sent as a direct message to the bot.

## How does the user reputation system work?

For every trade you make, you will be asked to rate your counterparty, while your counterparty will rate you.


## How do I create a purchase order?

When conversing with the bot [@lnp2pbot](https://t.me/lnp2pbot) you will find a menu button that will prompt you for the following commands:

You type `/buy <amount in sats> <amount in fiat> <fiat code> <payment method> [premium/discount]` without the special characters

Ex. `/buy 100000 50 usd "xyz bank"` **Buy one hundred thousand sats at fifty dollars payment by xyz bank**

Eg `/buy 0 50 you see "bank xyz"` **I buy fifty bolivars in sats -in this case the bot will calculate at the market rate- payment by bank xyz**

Ex. `/buy 0 10-100 pen "mobile payment"` **I buy from 10 to 100 nuevos soles -in this case the seller will choose the amount to sell you in that range- payment by mobile payment**

Ex. `/buy 0 100 eur -3 "mobile payment"` **I buy 100 euros discounting 3% -in this case the bot will calculate the market rate discounting or increasing the percentage you choose- payment by mobile payment* *

If there is any non-compatible variable, the bot will indicate it to you during the order creation process. Upon completion, it will automatically be published on the exchange channel and will be visible for a period of 23 hours.

## How do I create a sell order?

The procedure is exactly the same as for the purchase order, substituting the `/buy` command for `/sell`

The bot has a menu button that will prompt you for the following commands:

You type `/sell <amount in sats> <amount in fiat> <fiat code> <payment method> [premium/discount]` without the special characters

Ex. `/sell 100000 50 usd "bank xyz"` **I sell one hundred thousand sats at fifty dollars I charge by bank xyz**

Eg `/sell 0 50 see "bank xyz"` **I sell fifty bolivars in sats -in this case the bot will do the calculation at the market rate- charge by bank xyz**

Eg `/sell 0 10-100 pen "bank xyz"` **I sell from 10 to 100 nuevos soles -in this case the buyer will choose the amount to buy from you in that range- mobile payment charge**

Ex. `/sell 0 100 eur bizum 3` **I sell 100 euros increasing 3% -in this case the bot will calculate the market rate increasing the percentage you choose- charge by bizum**

If there is any non-compatible variable, the bot will indicate it to you during the order creation process. Upon completion, it will be published on the exchange channel and will be visible for a period of 23 hours.

## How do I find and accept an offer to buy or sell?

In the channel [@p2plightning](https://t.me/p2plightning) you will find the offers of all the participants, including yours. Just scroll through until you find one that suits your search and hit the "buy satoshis" or "sell satoshis" button.

## How do I cancel a posted order?

If the order has not been taken, simply use the command `/cancel <order id>` in your chat with the bot

The ID or identification number of your order appears just below the message of acceptance and publication of the same, and it is even indicated to you as an option to cancel it.

If the order has been taken, you must initiate a cooperative cancellation.

## Are there minimum or maximum limits on the amounts I can trade?

From the bot, there are no limits to the volume of your transaction. However, it will depend on the capacity of the network and the liquidity of the channel that you can find a maximum limit at a given moment.


## How long does it take to finalize a transaction?

It depends on several factors. Being a P2P exchange, the main one is the taking of your offer by a counterparty. Your post will be available for up to 23 hours and will then be automatically deleted if it is not taken.

Once an offer is accepted, a 15-minute window is opened to pay the lighting bill and for the bot to contact both parties. From here, they have a maximum time of two hours to complete the operation, since upon expiration, the sats will be returned to the wallet they came from, for this reason users must only use instant fiat money payment methods.

As both participants are online and agree on immediate payment methods, transactions are almost instantaneous.

## Fees and commissions?

The bot charges a flat rate of 0.6%, which includes the network fee, so there are no additional charges. This commission is paid only by the seller, not the buyer.

## What exchange rate does the bot use?

When creating an order without specifying the amount in sats you want to buy/sell, but rather the fiat amount to pay/charge, the bot will make the calculation at the market rate offered by [yadio.io](https://yadio.io)

## In which countries is it available?

Being a P2P exchange on telegram, it is technically available to everyone who has this app. However, so far the bot interacts with a list of 58 currencies with which you can create buy/sell orders.

Here we leave you the list

Code | Name | |
|---|---|---|
AED | United Arab Emirates Dirham | 🇦🇪
ARS | Peso argentino | 🇦🇷
AUD | Australian Dollar | 🇦🇺
AZN | Azerbaijani Manat | 🇦🇿
BOB | Boliviano | 🇧🇴
BRL | Brazilian Real | 🇧🇷
BYN | Belarusian Ruble | 🇧🇾
CHF | Swiss Franc | 🇨🇭
CAD | Canadian Dollar | 🇨🇦
CLP | Peso chileno | 🇨🇱
CNY | Chinese Yuan | 🇨🇳
COP | Peso colombiano | 🇨🇴
CRC | Colón | 🇨🇷
CUP | Peso cubano | 🇨🇺
CZK | Czech Republic Koruna | 🇨🇿
DKK | Danish Krone | 🇩🇰
DOP | Peso dominicano | 🇩🇴
EUR | Euro | 🇪🇺
GBP | British Pound Sterling | 🇬🇧
GHS | Ghanaian Cedi | 🇬🇭
GTQ | Quetzal | 🇬🇹
HKD | Hong Kong Dollar | 🇭🇰
HUF | Hungarian Forint | 🇭🇺
IDR | Indonesian Rupiah | 🇮🇩
ILS | Israeli New Sheqel | 🇮🇱
INR | Indian Rupee | 🇮🇳
JMD | Jamaican Dollar | 🇯🇲
JPY | Japanese Yen | 🇯🇵
KES | Kenyan Shilling | 🇰🇪
KRW | South Korean Won | 🇰🇷
KZT | Kazakhstani Tenge | 🇰🇿
MXN | Peso mexicano | 🇲🇽
MYR | Malaysian Ringgit | 🇲🇾
NAD | Namibian Dollar | 🇳🇦
NGN | Nigerian Naira | 🇳🇬
NOK | Norwegian Krone | 🇳🇴
NZD | New Zealand Dollar | 🇳🇿
PAB | Panamanian Balboa | 🇵🇦
PEN | Peruvian Nuevo Sol | 🇵🇪
PHP | Philippine Peso | 🇵🇭
PKR | Pakistani Rupee | 🇵🇰
PLN | Polish Zloty | 🇵🇱
PYG | Paraguayan Guarani | 🇵🇾
QAR | Qatari Rial | 🇶🇦
RON | Romanian Leu | 🇷🇴
RUB | Russian Ruble | 🇷🇺
SAR | Saudi Riyal | 🇸🇦
SEK | Swedish Krona | 🇸🇪
SGD | Singapore Dollar | 🇸🇬
TRY | Turkish Lira | 🇹🇷
TTD | Trinidad and Tobago Dollar | 🇹🇹
UAH | Ukrainian Hryvnia | 🇺🇦
USD | US Dollar | 🇺🇸
USDSV | USD en El Salvador | 🇺🇸🇸🇻
USDVE | USD en Bs | 🇺🇸🇻🇪
UYU | Peso uruguayo | 🇺🇾
VES | Bolívar | 🇻🇪
VND | Vietnamese Dong | 🇻🇳
ZAR | South African Rand | 🇿🇦

## Recommended Wallets

The following Wallets are the ones that have shown better performance when tested with the bot

* [Muun Wallet](https://muun.com/en/)
* [Blue Wallet](https://bluewallet.io/)
* [Phoenix Wallet](https://phoenix.acinq.co/)
* [@lntxbot](https://t.me/lntxbot)

## Support

@lnp2pbot is not a company, therefore it does not have a technical support department, although there is a community that you can go to in case you need help, remember that the participants in this community do not receive any type of remuneration, if You do not receive an immediate answer, be patient and educated that if someone has the answer at some point they will try to help you.

## Contact with developers

If you need to contact the developers use our github, if you have any proposal or want to report a bug go to the issues section and create one.

## I am a developer and I want to contribute

Brilliant! thanks for your interest, in the issues section you will see a list of issues to be resolved, choose one with the tag [help wanted](https://github.com/grunch/p2plnbot/issues?q=is%3Aissue+is%3Aopen+label%3A%22help+wanted%22) and if you have doubts you can ask by making a comment and then if you are sure you want to solve it, comment it, those with the label [good first issue](https://github.com/grunch/p2plnbot/issues?q=is%3Aissue+is%3Aopen+label%3A%22good+first+issue%22) are simple issues that often help you get familiar with the code.