# Installation

*Spanish guide version [here](INSTALL.es.md)*

**The following document is intended to provide the necessary information to prepare the work environment for the development of the bot by providing the technical and physical characteristics of each element.**

## Table of contents
- [Purpose](#purpose)
- [Target](#target)
- [System Scope](#system-scope)
- [Technical requirements](#technical-requirements)
- [Installation](#installation-1)
- [Using the bot](#using-the-bot)

## Purpose

Allow people to trade with other people on Telegram using the _Lightning Network_. The _lnp2pbot_ is developed in Node.js and connects to an LND (Lightning Network Daemon) node is a full implementation of a Lightning Network node. 

## Target

Achieving that the telegram bot is able to receive payments _Lightning_ without being custodian. Users won't need permission to use the service or provide personal data that could compromise their privacy, thus maintaining full custody of their assets at all times. The bot will use hold invoices and will only settle the seller's invoices when both parties agree. Immediately after this, the bot will pay the buyer's invoice.

## System Scope

Reach all users who want to acquire non-custodial Bitcoin satoshis through a Telegram bot.

## Technical requirements

1) Computer with internet access. 
2) Node management system [Polar](https:/lightningpolar.com/) or LND node.

![polar](images/polar.jpg)

3) [Docker](https://www.docker.com/): automation of application deployment as portable, self-sufficient containers that can run in the cloud or locally.

4) [MogoDB](https://www.mongodb.com/): database manager system.

## Installation

### Prepare the environment.

#### 1) Check if Node.js is installed.

```
$ node -v
```
In case it's not installed:

* On Mac run the following command:
```
$ brew install node
```

* On Linux and Windows, go to the following [link](https://nodejs.org/en/download/).


### MongoDB Configuration with Docker Compose

#### 2. Create the Directory and Configuration File

Create a directory where you will place the `mongo.yml` file for MongoDB:

```
$ mkdir mongodb
$ cd mongodb
$ nano mongo.yml
```

#### 3. Content of the mongo.yml file
The contents of the `mongo.yml` file must be:
```
version: "3.7"

services:
  mongodb:
    image: mongo:5.0
    environment:
      MONGO_INITDB_ROOT_USERNAME: mongoadmin
      MONGO_INITDB_ROOT_PASSWORD: secret
    volumes:
      - ./mongodb-data/:/data/db
    ports:
      - 27017:27017

```

#### 4. Start MongoDB
To start MongoDB, run the following command:
```
$ docker compose -f mongo.yml up
```

### Lnp2pbot
#### 5. Clone the Bot Repository
Clone the bot [repository](https://github.com/lnp2pBot/bot) and navigate to the project directory:
```
$ git clone https://github.com/lnp2pBot/bot.git
$ cd bot
$ npm install
```

#### 6. Create and Configure the .env file
In the root directory of the project, you will find a sample `.env-sample` file. Copy that file and edit it to configure your environment variables:
```
$ cp .env-sample .env
$ nano .env
```

#### Connect to the Lightning Node
To connect to an `LND` node, you need to set several variables in the `.env` file created in the previous step:

- _LND_CERT_BASE64:_ TLS certificate of the LND node in base64 format. You can obtain it with the command: `~/.lnd/tls.cert | tr -d '\n'`.

- _LND_MACAROON_BASE64:_ Macaroon file in base64 format. This file contains permissions to perform actions on the LND node. You can obtain it with the command:`~/.lnd/data/chain/bitcoin
/mainnet/admin.macaroon | tr -d '\n',`

- _LND_GRPC_HOST:_ IP address or domain name of the LND node and the port, separated by a colon. Example: `192.168.0.2:10009`.

If you are using [Polar](https://lightningpolar.com/), you can obtain the necessary information as shown in the following image:

![polarVariables](images/polarVariables.jpg)

#### Complete the configuration of the `.env` file

Here are the variables you need to modify in the `.env` file. The remaining variables can either keep their default values or be adjusted as you see fit:


```
LND_CERT_BASE64=''
LND_MACAROON_BASE64=''
LND_GRPC_HOST='' 
BOT_TOKEN=''

DB_USER='mongoadmin'
DB_PASS='secret'
DB_HOST='127.0.0.1'
DB_PORT='27017'
DB_NAME='lnp2pbot'

MONGO_URI='mongodb://mongoadmin:secret@localhost/lnp2pbot?authSource=admin'

CHANNEL='@your-offers-channel' 
ADMIN_CHANNEL='-10*****46' 
HELP_GROUP='@your-support-group' 

FIAT_RATE_EP='https://api.yadio.io/rate'

DISPUTE_CHANNEL='@your-dispute-channel' 

NOSTR_SK=''

RELAYS=''

```

Details of some variables:

- _BOT_TOKEN:_ You will need to go to Telegram and open [@BotFather](https://t.me/BotFather). Run the menu and choose `Create a new bot` where you will select the bot's name and username. Once generated, it will show you a token that you will place in this field.

- _CHANNEL:_ This is the channel where the bot posts offers. Create a channel on Telegram by pressing the button to write a new message. On Android, it is in the bottom right corner with a round icon featuring a pencil, and on iOS, it is in the top right corner with a small pencil-shaped icon. Press the `New Channel` option. Then, set the bot as a channel's administrator (open the bot and select: _Add to a group or channel_). Channel has to be public. Part after `t.me/` in link shown in channel info is what goes into __CHANNEL__ property (e.g. if link is `t.me/foo` then value should be `@foo`).

- _ADMIN_CHANNEL:_ This channel is where the bot sends relevant information to administrators, such as payments failures, when a user takes an order but doesn't proceed, among other things. In this field, you need to enter the channel ID. To obtain it, write a message in the channel, forward it to the `@JsonDumpBot`, and it will show you a JSON with the channel ID. More information can be found [here](https://gist.github.com/mraaroncruz/e76d19f7d61d59419002db54030ebe35). You need to add the bot as a channel's administrator.

![telegram_bot](images/telegram_bot.jpg)

- _HELP_GROUP:_ This is the group where you will provide bot support. You can create a new group or use an existing one.

- _DISPUTE_CHANNEL:_ This channel is where the bot posts disputes for solvers to take on (it's not a channel for resolving disputes, just for claiming them). You need to create this channel on Telegram and add the bot as an administrator.

- _NOSTR_SK:_ The private key for [Nostr](https://nostr.com/) that will publish the bot's offers as a [replaceable parameterized event type 38383](https://github.com/nostr-protocol/nips/blob/master/01.md#kinds). If you do not want your bot to publish offers on [Nostr](https://nostr.com/), comment out this variable.

- _RELAYS:_ The Nostr relays that the [Nostr](https://nostr.com/) user of your bot will connect to in order to publish offers. If you do not want your bot to publish offers on [Nostr](https://nostr.com/), comment out this variable.

### 7. Running the bot
```
$ npm start
```

- For testing purposes:
```
$ npm test
```

## Using the bot

After completing the [Installation](#installation-1) steps:

Start the bot with the command:

```
/start 
```

It will display a menu, we will choose the `/sell` option to sell with the necessary requirements.

![telegram](images/telegram.jpg)

2) In the channel you will see the offer, you must choose to buy with the other Telegram user.

![oferta](images/oferta.jpg)

3) Take the order in the channel. Click on Buy Satoshis.

![tomar_orden](images/tomar_orden.jpg)

4) Enter the bot and click continue.

![bot_continuar](images/bot_continuar.jpg)

This is the message that will be displayed.

![bot_tomar_oferta](images/bot_tomar_oferta.jpg)

5) Create invoice in Polar with some of the users and paste in Telegram. Choose `Create Invoice` in the behavior part.

![crear_factura](images/crear_factura.jpg)

6) Set the sales quantity.

![cantidad](images/cantidad.jpg)

7) Choose `Copy and Close.`

![copiar_factura](images/copiar_factura.jpg)

8) Enter the `bot` and paste the invoice. 

![factura](images/factura.jpg)

A request for payment will be sent to the seller and will be displayed in the `bot.`.

![solicitud](images/solicitud.jpg)

9) Paste the invoice in Polar and pay it. 

![pagar](images/pagar.jpg)

10) When someone takes the order, the `bot` will display the following message:

![solicitud_de_pago](images/solicitud_de_pago.jpg)

11) The following will be displayed in the `bot` for the other user:

![tomar_orden_venta](images/tomar_orden_venta.jpg)

12) The user must release the funds with the command `/fiatsent`, to do this he must copy and paste with the `id`

![fiatsent](images/fiatsent.jpg)

13) The `bot` will indicate that the user has already sent the fiat money.

![confirmar_envio](images/confirmar_envio.jpg)

14) The user must release the funds with the `/release` command by copying and pasting with the `id`.

![release](images/release.jpg)

15) Finally, the buyer will be notified that the transaction has been successfully completed.

![compra_exiosa](images/compra_exiosa.jpg)
