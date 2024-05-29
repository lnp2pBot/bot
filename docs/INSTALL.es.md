# Instalación

**El siguiente documento tiene como próposito brindar la información necesaria para poder preparar el ambiente de trabajo para el desarrolo del bot brindando las características técnicas y físicas de cada elemento.**

## Tabla de contenido
- [Próposito](#prop%C3%B3sito) 
- [Objetivo](#objetivo)
- [Alcance del sistema](#alcance-del-sistema)
- [Requerimientos técnicos](#requerimientos-t%C3%A9cnicos)
- [Instalación](#instalaci%C3%B3n-1)
- [Usar el bot](#usar-el-bot)

## Propósito

Permitir a las personas comerciar usando la red _Lightning_ con otras personas en Telegram. El bot _lnp2pbot_ está desarrollado en nodejs y se conecta con un nodo LND (Lightning Network Daemon) es una implementación completa de un nodo Lightning Network. 

## Objetivo

Lograr que el bot de telegram sea capaz de recibir pagos _Lightning_ sin ser custodio, el usuario no necesitará permiso para usar el servicio, ni proporcionar datos personales que puedan comprometer su privacidad, logrando con ello conservar toda la custodia de sus bienes en todo momento, para ello el bot usará facturas retenidas y sólo liquidará dichas facturas del vendedor cuando cada parte está de acuerdo con ello y justo después de ese momento el bot pagará la factura del comprador. 

## Alcance del sistema

Llegar a todos los usuarios que requieran adquirir satoshis de Bitcoin sin custodia por medio de un bot en Telegram.

## Requerimientos técnicos 

1) Computadora con acceso a internet. 
2) Sistema de gestión de nodos [Polar](https://lightningpolar.com/), o nodo LND.

![polar](images/polar.jpg)


3) [Docker](https://www.docker.com/): automatización de implementación de aplicaciones como contenedores portátiles y autosuficientes que se pueden ejecutar en la nube o localmente.
4) [MogoDB](https://www.mongodb.com/) como gestor de bases de datos.

## Instalación
### Preparar el ambiente.

#### 1. Verificar si tienes instalado Nodejs.

```
$ node -v
```

En caso de no tenerlo instalado:

* En Mac ejecuta la siguiente instrucción:
```
$ brew install node
```

* En Linux y Windows ir al siguiente [enlace](https://nodejs.org/en/download/).

### Configuración de MongoDB con Docker Compose

#### 2. Crear el directorio y el archivo de configuración

Crea un directorio donde colocarás el archivo `mongo.yml` para MongoDB:

```
mkdir mongodb
cd mongodb
nano mongo.yml
```
#### 3. Contenido del archivo mongo.yml
El archivo mongo.yml debe contener lo siguiente:

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

#### 4. Iniciar MongoDB
Para iniciar MongoDB, ejecuta el siguiente comando:  

```
$ docker compose -f mongo.yml up
```

### Lnp2pbot

#### 5. Clonar el repositorio del bot
Clona el [repositorio](https://github.com/lnp2pBot/bot) del bot y navega al directorio del proyecto:

```
$ git clone https://github.com/lnp2pBot/bot.git
$ cd bot
$ npm install
```

#### 6. Crear y Configurar el archivo `.env`
En el directorio raíz del proyecto, encontrarás un archivo de ejemplo `.env-sample`. Copia este archivo y edítalo para configurar tus variables de entorno:

```
$ cp .env-sample .env
$ nano .env
```

#### Conectar con el nodo Lightning

Para conectar con un nodo `lnd`, necesitas establecer algunas variables dentro del archivo `.env` creado en el paso anterior:

- _LND_CERT_BASE64:_ Certificado TLS del nodo LND en formato base64, puede obtenerlo base64 `~/.lnd/tls.cert | tr -d '\n'` en el nodo lnd.

- _LND_MACAROON_BASE64:_ Archivo macarrón en formato base64, el archivo macarrón contiene permiso para realizar acciones en el nodo lnd, puede obtenerlo con base64 `~/.lnd/data/chain/bitcoin
/mainnet/admin.macaroon | tr -d '\n',`

- _LND_GRPC_HOST:_ dirección IP o el nombre de dominio desde el nodo LND y el puerto separado por dos puntos, ej: `192.168.0.2:10009.`

Si estás usando [Polar](https://lightningpolar.com/) los datos los obtienes como se muestra en la siguiente imagen:

![polarVariables](images/polarVariables.jpg)

#### Terminar la configuración del archivo `.env`

A continuación están las variables que debes modificar en el archivo `.env`. El resto pueden mantener el valor por defecto o ser modificadas a tu consideración:

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

CHANNEL='@tu-canal-de-ofertas' 
ADMIN_CHANNEL='-10*****46' 
HELP_GROUP='@tu-grupo-de-soporte' 

FIAT_RATE_EP='https://api.yadio.io/rate'

DISPUTE_CHANNEL='@tu-canal-de-disputas' 

NOSTR_SK=''

RELAYS=''

```
Detalles de algunas variables:   

- _BOT_TOKEN:_ Deberás entrar a Telegram y abrir [@BotFather](https://t.me/BotFather). Ejecuta el menú y elige `Create a new bot` donde elegirás el nombre del bot y el usuario, una vez generado te mostrará un token que colocarás en este campo. 

- _CHANNEL:_ En ese canal el bot publica las ofertas. Crea un canal en Telegram, para ello pulsa el botón de escribir nuevo mensaje. En Android está en la esquina inferior derecha con un icono redondo con un lápiz, y en iOS está en la superior derecha con un icono bastante pequeño con la forma de un lápiz. Pulsa sobre la opción `Nuevo canal`. Luego pon al bot como administrador del canal (abrir el bot y seleccionar: _Añadir a un grupo o canal_). 

- _ADMIN_CHANNEL:_ A ese canal el bot envía información relevante para los administradores, como el fallo del pago de facturas, cuando un usuario toma una orden y no continúa, entre otras. En este campo debes poner el ID del canal, para obtenerlo escribe un mensaje en el canal, reenvíalo al bot `@JsonDumpBot` y te mostrará un JSON con el ID del canal. Más información [aquí](https://gist.github.com/mraaroncruz/e76d19f7d61d59419002db54030ebe35). Debes añadir al bot como administrador del canal. 

![telegram_bot](images/telegram_bot.jpg)

- _HELP_GROUP:_ Grupo donde darás soporte del bot. Puedes crear un nuevo grupo o utilizar uno que tengas creado previamente.

- _DISPUTE_CHANNEL:_ En ese canal el bot publica las disputas para que los solvers las tomen (no es un canal para resolver disputas, sino para tomarlas). Debes crear este canal en Telegram y añadir al bot como administrador.

- _NOSTR_SK:_ Clave privada de [Nostr](https://nostr.com/) que publicará las ofertas del bot como un [evento parametrizado remplazable tipo 38383](https://github.com/nostr-protocol/nips/blob/master/01.md#kinds). Si no quieres que tu bot publique las ofertas en [Nostr](https://nostr.com/), comenta esa variable.

- _RELAYS:_ Relays de [Nostr](https://nostr.com/) a los que se conectará el usuario de [Nostr](https://nostr.com/) de tu bot para publicar las ofertas. Si no quieres que tu bot publique las ofertas en [Nostr](https://nostr.com/), comenta esa variable.

### 7. Ejecutar el bot

```
$ npm start
```

- Para hacer pruebas:

```
$ npm test
```

## Usar el bot

Luego de completar los pasos de la [Instalación](#instalaci%C3%B3n-1):

1) Inicia el bot con el comando:

```
/start 
```
Mostrará un menú, elegiremos la opción de `/sell` para vender con los requerimientos necesarios.

![telegram](images/telegram.jpg)

2) En el canal se verá la oferta, debe elegir comprar con el otro usuario de Telegram.

![oferta](images/oferta.jpg)

3) Tomar la orden en el canal. Dar clic en Comprar Satoshis.

![tomar_orden](images/tomar_orden.jpg)

4) Entrar al bot y dar clic en continuar.

![bot_continuar](images/bot_continuar.jpg)

Este mensaje es el que se le mostrará.

![bot_tomar_oferta](images/bot_tomar_oferta.jpg)

5) Crear factura en Polar con algunos de los usuarios y pegar en Telegram. Elegir `Crear Factura` en la parte de comportamiento.

![crear_factura](images/crear_factura.jpg)

6) Poner la cantidad de venta. 

![cantidad](images/cantidad.jpg)

7) Elegir `copiar y Cerrar.`

![copiar_factura](images/copiar_factura.jpg)

8) Entrar al `bot` y pegar la factura. 

![factura](images/factura.jpg)

Llegará una solicitud de pago al vendedor que se verá en el `bot.`

![solicitud](images/solicitud.jpg)

9) Pegar la factura en Polar y pagarla. 

![pagar](images/pagar.jpg)

10) Cuando alguien tome la orden, el `bot` mostrará el siguiente mensaje:

![solicitud_de_pago](images/solicitud_de_pago.jpg)

11) En el `bot` para el otro usuario se mostrará lo siguiente:

![tomar_orden_venta](images/tomar_orden_venta.jpg)

12) El usuario debe liberar los fondos con el comando `/fiatsent`, para ello debe copiar y pegar con el `id`

![fiatsent](images/fiatsent.jpg)

13) El `bot` indicará que el usuario ya envió el dinero fiat.

![confirmar_envio](images/confirmar_envio.jpg)

14) El usuario debe liberar los fondos con el comando `/release`, para ello debe copiar y pegar con el `id`

![release](images/release.jpg)

15) Finalmente se le avisará al comprador que su operación ha sido completada con éxito.

![compra_exiosa](images/compra_exiosa.jpg)
