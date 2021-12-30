# P2PLNBot

## El siguiente documento tiene como próposito brindar la información necesaria para poder preparar el ambiente de trabajo para el desarrolo del bot brindando las características técnicas y 
físicas de cada elemento.

1. Próposito.
2. Objetivo.
3. Alcance.
4. Requerimientos técnicos.
5. Preparar el ambiente de trabajo. 
* Docker.
* MongoDB.
* P2plnbot.
* Conectar con un nodo Lightning.


## Propósito.

Permitir a las personas comerciar usando la red _Lightning_ con otras personas en Telegram. El bot _p2plnbot_ está desarrollado en nodejs y se conecta con un nodo LND (Lightning Network Daem
on) es una implementación completa de un nodo Lightning Network. 

## Objetivo.

Lograr que el bot de telegram sea capaz de recibir pagos _Lightning_ sin ser custodio, es decir; que el usuario no necesitará permiso para usar el servicio, ni proporcionar datos personales 
que puedan comprometer su privacidad logrando con ello conservar toda la custodia de sus bienes en todo momento, para ello el bot usará facturas retenidas y sólo liquidará dichas facturas de
l vendedor cuando cada parte está de acuerdo con ello y justo después de ese momento el bot pagará la factura del comprador. 

## Alcance del sistema.

Llegar a todos los usuarios que requieran adquirir satoshis de Bitcoin sin custodia por medio de un bot en Telegram.

## Requerimientos técnicos. 

1) Computadora con acceso a internet. 
2) Sistema de gestión de nodos [Polar.](https://lightningpolar.com/)

![polar](polar.jpg)


3) [Docker](https://www.docker.com/): automatización de implementación de aplicaciones como contenedores portátiles y autosuficientes que se pueden ejecutar en la nube o localmente.
4) [MogoDB](https://www.mongodb.com/) como gestor de bases de datos.

## Preparar el ambiente.

1) Verificar si tiene instalado Nodejs.

```
$ node -v
```

En caso de no tenerlo instalado:

* En Mac ejecute la siguiente instrucción:
```
$ brew install node
```

* En Windows ir al siguiente [enlace.](https://nodejs.org/en/download/)
* En Linux:

```
$ sudo apt install npm
```

## Docker

2) Crear un directorio donde colocara el archivo `docker-compose.yml` para MongoDB con los siguientes valores:

```
mkdir mongodb
cd mongodb
mkdir db-data
vi docker-compose.yml
```

El archivo debe contener lo siguiente:

```
version: "3.7"

services:
  mongodb:
    image: mongo:5.0
    environment:
      MONGO_INITDB_ROOT_USERNAME: mongoadmin
      MONGO_INITDB_ROOT_PASSWORD: secret
    volumes:
      - ./db-data/:/data/db
    ports:
      - 27017:27017
```

3) Verificar si está levantado Docker con la siguiente instrucción:

```
$ docker ps –a
```

_Nota: Al ejecutar el primer comando verás la imagen que has creado._

* Levantar el contenedor.

```
$ docker-compose up –d
```

* Entrar al contenedor, para ello deberá ejecutar las siguientes instrucciones: 

```
$ docker ps –a
```

* Este comando le mostrará el ID que se ha creado para posteriormente entrar al contenedor:

```
$ docker exec -it <container id> /bin/bash
```

_Nota: Entrar al contenedor te permitirá entrar a la BD._

## MongoDB

4) Entrar a MongoDB

```
$ mongo admin -u mongoadmin –p secret
$ show dbs
$ use nueva_db ej.
```

## P2plnbot

5) Clonar el [repositorio](https://github.com/grunch/p2plnbot.git) del bot:

```
$ git clone https://github.com/grunch/p2plnbot.git
$ cd p2plnbot
$ npm install
```
6) Crear un archivo `.env`, en el directorio raíz del proyecto, viene uno de ejemplo, así que solo necesitara copiarlo y rellenar algunos datos:

• Ejecute las siguientes instrucciones:

```
$ cp .env-sample .env
$ vi .env
```

## Conectar con el nodo de Lightning. 

• Para conectar con un nodo `lnd`, necesitamos establecer algunas variables:

**LND_CERT_BASE64:** Certificado TLS del nodo LND en formato base64, puede obtenerlo base64 `~/.lnd/tls.cert | tr -d '\n'` en el nodo lnd.

**LND_MACAROON_BASE64:** Archivo macarrón en formato base64, el archivo macarrón contiene permiso para realizar acciones en el nodo lnd, puede obtenerlo con base64 `~/.lnd/data/chain/bitcoin
/mainnet/admin.macaroon | tr -d '\n',`

* Si está usando Polar los datos los obtiene como se muestra en la siguiente imagen:

![polarVariables](polarVariables.jpg)


**LND_GRPC_HOST:** dirección IP o el nombre de dominio desde el nodo LND y el puerto separado por dos puntos, ej: `192.168.0.2:10009.`

**BOT_TOKEN:** Deberá entrar a Telegram y buscar `BotFather.` Ejecutar el menú y elegir `Create a new bot` donde elegirá el nombre del bot y el usuario, una vez generado le mostrará un númer
o de token que es que se colocará en este campo. 

**CHANNEL:** Cree un canal en Telegram, para ello pulse el botón de escribir nuevo mensaje. En Android está en la esquina inferior derecha con un icono redondo con un lápiz, y en iOS está en
 la superior derecha con un icono bastante pequeño con la forma de un lápiz. Pulse sobre la opción `Nuevo canal`.

**ADMIN_CHANNEL:** Este dato será el ID de su canal, para obtenerlo escriba un mensaje en su canal, reenvíelo al bot `@JsonDumpBot` y le mostrara un JSON con el ID del canal. 

![telegram_bot](telegram_bot.jpg)

* Más información [aquí.](https://gist.github.com/mraaroncruz/e76d19f7d61d59419002db54030ebe35)

* Archivo `.env`

```
LND_CERT_BASE64=
LND_GRPC_HOST='127.0.0.1:10001'
BOT_TOKEN='1862047833:AAEFx4SSm1sDdiw9vvHzChdtKpC4WuVFRjw'
FEE=.001
DB_USER='mongoadmin'
DB_PASS='secret'
DB_HOST='localhost'
DB_PORT='27017'
DB_NAME='p2plnbot'

INVOICE_EXPIRATION_WINDOW=60000
HOLD_INVOICE_EXPIRATION_WINDOW=60
CHANNEL='@testeandomascosas'
ADMIN_CHANNEL='-1001323811481'

MAX_DISPUTES=8
ORDER_EXPIRATION_WINDOW=7200

PENDING_PAYMENT_WINDOW=5

FIAT_RATE_EP='https://api.yadio.io/rate'
```
• Una vez editado el archivo ejecutar la siguiente instrucción:

```
$ npm start
```

• Para hacer pruebas:

```
$ npm test
```

## Comenzar con el bot.

• Será necesario haber creado ya un bot con `BotFather`, tener otra número para usar con Telegram y haber abierto canales en Polar.

1) Entrar al bot y teclear lo siguiente:

```
/start 
```

Mostrará un menú, elegiremos la opción de `/sell` para vender con los requerimientos necesarios.

![telegram](telegram.jpg)


2) Debe iniciar el bot con esa misma cuanta con el comando:

```
/start
```

3) En el canal se verá la oferta, debe elegir comprar con el otro usuario de Telegram.

![oferta](oferta.jpg)

4) Tomar la orden en el canal. Dar clic en Comprar Satoshis.

![tomar_orden](tomar_orden.jpg)

5) Entrar al bot y dar clic en continuar.

![bot_continuar](bot_continuar.jpg)

Este mensaje es el que se le mostrará.

![bot_tomar_oferta](bot_tomar_oferta.jpg)

6) Crear factura en Polar con algunos de los usuarios y pegar en Telegram. Elegir `Crear Factura` en la parte de comportamiento.

![crear_factura](crear_factura.jpg)

7) Poner la cantidad de venta. 

![cantidad](cantidad.jpg)

8) Elegir `copiar y Cerrar.`

![copiar_factura](copiar_factura.jpg)

9) Entrar al `bot` y pegar la factura. 

![factura](factura.jpg)

Llegará una solicitud de pago al vendedor que se verá en el `bot.`

![solicitud](solicitud.jpg)

10) Pegar la factura en Polar y pagarla. 

![pagar](pagar.jpg)

11) Cuando alguien tome la orden, el `bot` mostrará el siguiente mensaje:

![solicitud_de_pago](solicitud_de_pago.jpg)

12) En el `bot` para el otro usuario se mostrará lo siguiente:

![tomar_orden_venta](tomar_orden_venta.jpg)

13) El usuario debe liberar los fondos con el comando `/fiatsent`, para ello debe copiar y pegar con el `id`

![fiatsent](fiatsent.jpg)

14) El `bot` indicará que el usuario ya envió el dinero fiat.

![confirmar_envio](confirmar_envio.jpg)


15) El usuario debe liberar los fondos con el comando `/release`, para ello debe copiar y pegar con el `id`

![release](release.jpg)

17) Finalmente se le avisará al comprador que su operación ha sido completada con éxito.

![compra_exiosa](compra_exiosa.jpg)

A
A
A
A
A
A
A
A
A
A
A
A
A
A
A
A
A
A
A
A
A
A
A
A
A
A
A
A
A
A
A
A
A
A
A
A
A
A
A
A
A
A
A
A
A
A
A
A
A
A
A
A
A
A
A
A
A
A
A
A
A
A
A
A
A
A
A
A

