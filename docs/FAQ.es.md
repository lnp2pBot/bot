# Preguntas de uso frecuente

- [¿Qué es LNP2Pbot?](#qué-es-lnp2pbot)
- [¿Qué es Lightning Network?](#qué-es-lightning-network)
- [¿Qué necesito para usar LNP2Pbot?](#qué-necesito-para-usar-lnp2pbot)
- [¿Cómo inicializo el bot?](#cómo-inicializo-el-bot)
- [¿Cuáles son los canales para realizar intercambios en telegram?](#cuáles-son-los-canales-para-realizar-intercambios-en-telegram)
- [¿Necesito llenar algún registro de usuario o verificación de identidad?](#necesito-llenar-algún-registro-de-usuario-o-verificación-de-identidad)
- [¿Qué tipo de información recopilan de cada usuario?](#qué-tipo-de-información-recopilan-de-cada-usuario)
- [¿Cómo funciona el sistema de reputación de usuario?](#cómo-funciona-el-sistema-de-reputación-de-usuario)
- [¿Cómo creo una orden de compra?](#cómo-creo-una-orden-de-compra)
- [¿Cómo creo una orden de venta?](#cómo-creo-una-orden-de-venta)
- [¿Cómo busco y acepto una oferta de compra o venta?](#cómo-busco-y-acepto-una-oferta-de-compra-o-venta)
- [¿Cómo cancelo una orden publicada?](#cómo-cancelo-una-orden-publicada)
- [¿Hay límites mínimos o máximos en las cantidades que puedo transar?](#hay-límites-mínimos-o-máximos-en-las-cantidades-que-puedo-transar)
- [¿Cuánto tiempo toma concretar una transacción?](#cuánto-tiempo-toma-concretar-una-transacción)
- [¿Tarifas y comisiones?](#tarifas-y-comisiones)
- [¿Qué tasa de cambio utiliza el bot?](#qué-tasa-de-cambio-utiliza-el-bot)
- [¿En qué países está disponible?](#en-qué-países-está-disponible)
- [Wallets recomendadas](#wallets-recomendadas)
- [Soporte](#soporte)
- [Contacto con desarrolladores](#contacto-con-desarrolladores)
- [Soy desarrollador y quiero contribuir](#soy-desarrollador-y-quiero-contribuir)
## ¿Qué es LNP2Pbot?

LNP2PBOT es un intercambio persona a persona, de código abierto, no custodio, sin registro de usuario ni verificación de identidad, que funciona sobre un bot de Telegram y permite comprar y vender sats (unidad de medida mínima en fracciones de Bitcoin) a través de Ligthning Network.


## ¿Qué es Lightning Network?

Ligthning Network es una red de canales de pago que funciona como protocolo de segunda capa sobre la red Bitcoin, aprovechando la propiedad de escribir contratos inteligentes en su blockchain. Es una solución de escalabilidad que permite incrementar exponencialmente el número de transacciones y la velocidad de las mismas al no necesitar confirmaciones on-chain, a su vez que reducir drásticamente las comisiones de red. Los pagos se vuelven instantáneos y de costo casi nulo.


## ¿Qué necesito para usar LNP2Pbot?

Solo necesitas una cuenta de Telegram con el "username" activado, inicializar el bot y una Wallet que soporte Ligthning Network (Acá te dejamos algunas sugerencias LINK A FAQ MEDIOS DE PAGO Y WALLETS RECOMENDADAS).

## ¿Cómo inicializo el bot?

Escríbele en privado a [@lnp2pbot](https://t.me/lnp2pbot) y ejecuta el comando `/start`.

## ¿Cuáles son los canales para realizar intercambios en telegram?

Para crear tus órdenes de compra / venta escríbele a [@lnp2pbot](https://t.me/lnp2pbot).

Para tomar ofertas de compra / venta ingresa al canal [@p2plightning](https://t.me/p2plightning).

## ¿Necesito llenar algún registro de usuario o verificación de identidad?

¡NO! Bitcoin nació como "un sistema de dinero electrónico persona a persona" y nos enorgullece apoyar ese principio. Ningún dato personal te es requerido, los intercambios son totalmente entre pares y LNP2PBot no recopila ni almacena ninguna información personal de las partes implicadas.

## ¿Qué tipo de información recopilan de cada usuario?

Para efectos del sistema de reputación de usuario, solo la cantidad de transacciones concretadas, el volumen total comerciado, la calificación de contraparte, y el score de disputas en caso de incurrir en alguna. De esta información, solo es pública por defecto la cantidad de transacciones y la calificación de contraparte, y opcional (tu eliges mostrarlo o no, por defecto no se muestra) el volumen total comerciado y tu username.

En caso de que desees mostrar tu nombre de usuario y/o volumen comerciado para acompañar tu reputación en las ofertas que publicas, deberás hacerlo manualmente a través de los siguientes comandos:
```
/showusername yes

/showvolume yes
```
Cada comando se le envía como un mensaje directo al bot.

## ¿Cómo funciona el sistema de reputación de usuario?

Por cada transacción que realices, se te pedirá calificar a tu contraparte, a la vez que este te calificará a ti.


## ¿Cómo creo una orden de compra?

Al conversar con el bot [@lnp2pbot](https://t.me/lnp2pbot) encontrarás un botón de menú que te indicará los siguientes comandos:

Escribes `/buy <monto en sats> <monto en fiat> <código fiat> <método de pago> [prima/descuento]` sin los carácteres especiales

Ej. `/buy 100000 50 usd "banco xyz"` **Compro cien mil sats a cincuenta dólares pago por banco xyz**

Ej. `/buy 0 50 ves "banco xyz"` **Compro cincuenta bolívares en sats -en este caso el bot hará el cálculo a la tasa de mercado- pago por banco xyz**

Ej. `/buy 0 10-100 pen "pago móvil"` **Compro de 10 a 100 nuevos soles -en este caso el vendedor elegirá que monto venderte en ese rango- pago por pago móvil**

Ej. `/buy 0 100 eur -3 "pago móvil"` **Compro 100 euros descontando 3% -en este caso el bot hará el cálculo a la tasa de mercado descontando o incrementando el porcentaje que elijas- pago por pago móvil**

De haber alguna variable no compatible el bot te lo indicará durante el proceso de creación de orden. Al completarla, la misma se publicará automáticamente en el canal de intercambio y será visible por un período de 23 horas.

## ¿Cómo creo una orden de venta?

El procedimiento es exactamente el mismo a la orden de compra, sustituyendo el comando `/buy` por `/sell`

El bot tiene un botón de menú que te indicará los siguientes comandos:

Escribes `/sell <monto en sats> <monto en fiat> <código fiat> <método de pago> [prima/descuento]` sin los carácteres especiales

Ej. `/sell 100000 50 usd "banco xyz"` **Vendo cien mil sats a cincuenta dólares cobro por banco xyz**

Ej. `/sell 0 50 ves "banco xyz"` **Vendo cincuenta bolívares en sats -en este caso el bot hará el cálculo a la tasa de mercado- cobro por banco xyz**

Ej. `/sell 0 10-100 pen "banco xyz"` **Vendo de 10 a 100 nuevos soles -en este caso el comprador elegirá que monto comprarte en ese rango- cobro por pago móvil**

Ej. `/sell 0 100 eur bizum 3` **Vendo 100 euros incrementando 3% -en este caso el bot hará el cálculo a la tasa de mercado incrementando el porcentaje que elijas- cobro por bizum**

De haber alguna variable no compatible el bot te lo indicará durante el proceso de creación de orden. Al completarla, la misma se publicará en el canal de intercambio y será visible por un período de 23 horas.

## ¿Cómo busco y acepto una oferta de compra o venta?

En el canal [@p2plightning](https://t.me/p2plightning) encontrarás publicadas las ofertas de todos los participantes, incluídas las tuyas. Simplemente revísalo hasta encontrar alguna que se adapte a tu búsqueda y pulsa el botón "comprar satoshis" o "vender satoshis"

## ¿Cómo cancelo una orden publicada?

Si la orden no ha sido tomada, simplemente utilizas el comando `/cancel <orden id>` en tu chat con el bot

El ID o número identificador de tu orden aparece justo debajo del mensaje de aceptación y publicación de la misma, e incluso, se te indica como opción para cancelarla.

Si la orden ha sido tomada, deberás iniciar una cancelación cooperativa.

## ¿Hay límites mínimos o máximos en las cantidades que puedo transar?

Desde el bot, no hay límites para el volumen de tu transacción. Sin embargo, dependerá de la capacidad de la red y la liquidez del canal que puedas en determinado momento encontrar un límite máximo.


## ¿Cuánto tiempo toma concretar una transacción?

Depende de varios factores. Por ser un intercambio P2P, el principal es la toma de tu oferta por un contraparte. Tu publicación estará disponible hasta por 23 horas y luego será automáticamente eliminada si la misma no es tomada.

Una vez aceptada una oferta, se abre una ventana de tiempo de 15 minutos para pagar la factura ligthning y que el bot ponga en contacto a ambas partes. A partir de acá, tienen un tiempo máximo de dos horas para concretar la operación, ya que al expirar, los sats serán devueltos a la wallet de procedencia, por esta razón los usuarios deben utilizar únicamente medios de pago de dinero fiat instantáneos.

Al estar ambos participantes en línea y acordar métodos de pago inmediatos, las transacciones son casi instantáneas.

## ¿Tarifas y comisiones?

El bot cobra una tasa fija de 0,6%, que incluye la tarifa de red, por lo que no hay cobros adicionales. Esta comisión la paga solo el vendedor, no el comprador.

## ¿Qué tasa de cambio utiliza el bot?

Al crear una orden sin especificar la cantidad en sats que deseas comprar/vender, sino el monto fiat a pagar/cobrar, el bot hará el cálculo a tasa de mercado ofrecida por [yadio.io](https://yadio.io)

## ¿En qué países está disponible?

Al ser un intercambio P2P sobre telegram, técnicamente está disponible para todo el que tenga esta app. Sin embargo, hasta el momento el bot interactúa con un listado de 58 monedas con las que puedes crear órdenes de compra/venta.

Acá te dejamos el listado

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

## Wallets recomendadas

Las siguientes Wallets son las que han demostrado un mejor rendimiento al testearlas con el bot

* [Muun Wallet](https://muun.com/es/)
* [Blue Wallet](https://bluewallet.io/)
* [Phoenix Wallet](https://phoenix.acinq.co/)
* [@lntxbot](https://t.me/lntxbot)

## Soporte

@lnp2pbot no es una empresa, por ello no cuenta con un departamento de soporte técnico, aunque sí hay una comunidad a la que puedes acudir en caso de que necesites ayuda, recuerda que los participantes en esta comunidad no reciben ningún tipo de remuneración, si no recibes respuesta inmediata, se paciente y educado que si alguien tiene la respuesta en algún momento intentará ayudarte.

## Contacto con desarrolladores

Si necesitas contactarse con los desarrolladores utiliza nuestro github, si tienes alguna propuesta o quieres reportar un bug ve a la sección de issues y crea uno.

## Soy desarrollador y quiero contribuir

¡Genial! gracias por tu interés, en la sección de issues podrás ver una lista de issues por resolver, elige uno con etiqueta [help wanted](https://github.com/grunch/p2plnbot/issues?q=is%3Aissue+is%3Aopen+label%3A%22help+wanted%22) y si tienes dudas puedes preguntar haciendo un comentario y luego si estás seguro de que quieres resolverlo coméntalo, los que tienen etiqueta [good first issue](https://github.com/grunch/p2plnbot/issues?q=is%3Aissue+is%3Aopen+label%3A%22good+first+issue%22) son issues sencillos que muchas veces sirven para familiarizarte con el código.
