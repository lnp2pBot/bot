# P2PLNBot
Telegram bot which allows to people to trade using lightning network with other people on telegram, this is an open source project and anyone can create issues, submit a PR, fork it, modify it or create their own bot with the code.

**p2plnbot** is being developed on nodejs and connect with a LND node, after some thinking we couldn't find a good way telegram bot that give this kind of service without being custodial, but we developed a trust minimized model for this, we are not custodians of funds of the users, this is why we use hold invoices, the bot only settle seller invoices when each party is ok with it and at that same times the bot pay the buyer's invoice.

## Creating a sell order
1. Alice tells to the bot that she wants to sell 5000 sats by **n** fiat amount.
2. The bot send to alice a hold-invoice, Alice has to pay a hold-invoice of 5000 sats to the bot, this invoice is "pending", the money is not accepted or rejected by the bot at that moment.
3. After the bot detects that Alice paid the invoice, the offer is published on the channel.
4. Bob accepts the offer for 5000 sats
5. The bot put in contact Bob and Alice.
6. Bob sends the fiat money via bank transfer and also sends a new LN invoice for 5000 sats to the bot
7. When Alice confirmed that she received the money, the bot settles Alice's initial invoice and pays Bob's invoice.
8. If Alice does not confirm the operation that she received the payment in one hour, the bot cancels the hold-invoice and closes the order.

## Creating a buy order
1. Alice wants to buy 5000 sats
2. Alice publishes a buy offer of 5000 sats with **n** fiat amount, Alice does not have satoshis, but she has fiat, Alice sends an invoice to the bot, the bot saves it when she creates the order
3. The bot shows the offer in the group
4. Bob takes the offer, the bot sends him a hold-invoice for 5000.
5. Bob pays the invoice
6. The bot tells Alice that Bob has already made the payment, She can now send the fiat to Bob.
7. When Bob confirms that he received the fiat, the bot settles Bob's invoice and pays Alice's invoice.
8. If Bob does not confirm the operation that he received the payment in one hour, the bot cancels the hold-invoice and closes the order.

## Instalation
You will need to create an `.env` file on the root dir, you can use a sample env file called `.env.sample` on the root dir, an easy way of doing this is just to copy the sample file to `.env`.

```
cp .env-sample .env
```

### MongoDB
You will need to have [mongo](https://www.mongodb.com) installed and fill the mongo variables on the .env file, those that stats with `DB_`.

### Telegram
You will need a telegram bot api key (`BOT_TOKEN`), find out more about it [here](https://core.telegram.org/bots/).

### Lightning Network
You will need a lightning network node, for this bot we use [LND](https://github.com/lightningnetwork/lnd/).

To connect with a lnd node we need to set 3 variables in the `.env` file,

*LND_CERT_BASE64:* LND node TLS certificate on base64 format, you can get it with `base64 ~/.lnd/tls.cert | tr -d '\n'` on the lnd node.

*LND_MACAROON_BASE64:* Macaroon file on base64 format, the macaroon file contains permission for doing actions on the lnd node, you can get it with `base64 ~/.lnd/data/chain/bitcoin/mainnet/admin.macaroon | tr -d '\n'`.

*LND_GRPC_HOST:* IP address or domain name from the LND node and the port separated by colon (`:`), example: `192.168.0.2:10009`.

To install just run:
```
$ git clone https://github.com/grunch/p2plnbot.git
$ cd p2plnbot
$ npm install
```
## Running it
```
$ npm start
```
## Testing
```
$ npm test
```