# Especificación: Dashboard Web de Estadísticas en Tiempo Real — lnp2pBot

> **Documento de diseño e implementación**
> Versión: 1.0 · Estado: Propuesta · Audiencia: equipo de desarrollo
>
> Este documento es una guía de implementación completa para construir un sistema
> web que se conecta a la base de datos de lnp2pBot (MongoDB) y muestra
> estadísticas operativas y financieras en tiempo real: monedas/fiat con más
> operaciones exitosas, métricas diarias/mensuales/por rango, filtros por tipo y
> estado de orden, flujo de sats entrante y saliente del nodo Lightning, y
> conciliación de ganancias del bot y de las comunidades.

---

## Tabla de contenidos

1. [Objetivos y alcance](#1-objetivos-y-alcance)
2. [Contexto del dominio (cómo funciona el bot)](#2-contexto-del-dominio)
3. [Modelo de datos relevante](#3-modelo-de-datos-relevante)
4. [Definiciones canónicas de métricas](#4-definiciones-canónicas-de-métricas)
5. [Arquitectura del sistema](#5-arquitectura-del-sistema)
6. [Diseño de la API (REST + WebSocket)](#6-diseño-de-la-api)
7. [Catálogo de consultas de agregación (MongoDB)](#7-catálogo-de-consultas-de-agregación)
8. [Conciliación de ganancias (módulo financiero)](#8-conciliación-de-ganancias)
9. [Flujo de fondos del nodo Lightning](#9-flujo-de-fondos-del-nodo-lightning)
10. [Tiempo real: estrategia](#10-tiempo-real-estrategia)
11. [Frontend: vistas, filtros y componentes](#11-frontend-vistas-filtros-y-componentes)
12. [Seguridad, autenticación y privacidad](#12-seguridad-autenticación-y-privacidad)
13. [Rendimiento, índices y caché](#13-rendimiento-índices-y-caché)
14. [Despliegue y configuración](#14-despliegue-y-configuración)
15. [Plan de implementación por fases](#15-plan-de-implementación-por-fases)
16. [Pruebas](#16-pruebas)
17. [Anexos](#17-anexos)

---

## 1. Objetivos y alcance

### 1.1 Objetivo

Construir una aplicación web independiente ("Analytics Dashboard") que se conecte
**en modo solo-lectura** a la base de datos MongoDB de lnp2pBot y exponga:

- **Estadísticas en tiempo real** que se actualizan sin recargar (vía WebSocket /
  SSE alimentado por MongoDB Change Streams).
- **Rankings de monedas (fiat)** con más operaciones exitosas (diario, mensual y
  por rango de fechas elegido por el usuario).
- **Filtros por tipo de orden** (`buy` / `sell`) y por **estado** (`SUCCESS`,
  `CANCELED`, `EXPIRED`, `ACTIVE`, `DISPUTE`, etc.), p. ej. "número de órdenes
  canceladas en cierto periodo".
- **Flujo de sats del nodo Lightning**: monto entrante (hold invoices retenidos),
  monto saliente (pagos a compradores), y costos de ruteo.
- **Conciliación y ganancias**: ingresos del bot, ganancias de comunidades,
  costos de ruteo, saldos pendientes de retiro y verificación de integridad.

### 1.2 Principios de diseño

| Principio | Implicación |
|-----------|-------------|
| **Solo lectura** | El dashboard NUNCA escribe en las colecciones del bot. Usuario de DB con rol `read`. Esto evita interferir con la operación del bot. |
| **No tocar el bot** | El dashboard es un proceso separado. No se modifica el código del bot (salvo, opcionalmente, índices de DB). |
| **Reutilizar la lógica de negocio** | Las fórmulas de fees/ganancias deben replicar EXACTAMENTE las del bot (ver §8) para que la conciliación cuadre. |
| **Tiempo real eficiente** | Change Streams para deltas; agregaciones cacheadas para totales históricos. |
| **Privacidad** | No exponer PII (Telegram IDs, usernames, invoices, hashes) en vistas públicas. Ver §12. |

### 1.3 Fuera de alcance (v1)

- Escritura/administración de órdenes (eso lo hace el bot).
- Saldos de canales / wallet de LND en vivo (el bot **no** los almacena; ver §9.4
  para la propuesta opcional de snapshots).
- Exportación contable formal/declaraciones fiscales (se provee export CSV/JSON
  como base).

---

## 2. Contexto del dominio

lnp2pBot es un bot de Telegram para trading P2P de Bitcoin sobre Lightning usando
**hold invoices** como escrow sin confianza. Dos patrones de trade:

**Orden de venta (`sell`)** — el creador vende sats:
1. Vendedor crea orden → publicada en canal (`PENDING`).
2. Comprador toma → vendedor paga el hold invoice (sats **entran/se retienen** en el nodo).
3. Comprador envía fiat → vendedor confirma recepción.
4. Hold invoice se liquida → comprador recibe BTC (sats **salen** del nodo).

**Orden de compra (`buy`)** — el creador compra sats:
1. Comprador crea orden → publicada (`PENDING`).
2. Vendedor toma → vendedor paga el hold invoice.
3. Comprador provee invoice → vendedor envía fiat.
4. Comprador confirma recepción → hold invoice liquidado → comprador recibe BTC.

**Implicación para analítica:** el único estado que representa un trade **exitoso y
completado** es `SUCCESS`. Es el momento en que el bot incrementa
`trades_completed` y `volume_traded` de ambas partes y registra `routing_fee`.

### 2.1 Stack del bot (referencia)

- **Runtime:** Node.js ≥18, TypeScript (strict).
- **DB:** MongoDB vía Mongoose 8.
- **LN:** librería `lightning` 10.25.0 contra LND (gRPC).
- **Colecciones:** `orders`, `users`, `communities`, `disputes`, `pendingpayments`, `configs`, `blocks`.

---

## 3. Modelo de datos relevante

> Fuente de verdad: `models/*.ts` del repositorio. Resumen de campos usados por el
> dashboard. **Nota crítica:** los IDs de usuario/comunidad se almacenan como
> `string` (no ObjectId nativo en las referencias cruzadas como `seller_id`,
> `community_id`, etc.). El `_id` de cada documento sí es ObjectId pero tipado como
> `string` en las interfaces.

### 3.1 `orders` (colección central de analítica)

| Campo | Tipo | Significado / uso analítico |
|-------|------|------------------------------|
| `_id` | ObjectId | Identificador. **Contiene timestamp de creación** (útil para rango por tiempo sin índice extra). |
| `status` | string (enum) | Estado del ciclo de vida. Ver §3.1.1. Filtro principal. |
| `type` | string | `buy` o `sell`. Filtro principal. |
| `amount` | number | Monto en **satoshis**. Métrica de volumen. |
| `fiat_amount` | number | Monto fiat (orden de monto fijo). |
| `min_amount` / `max_amount` | number | Rango fiat (órdenes de rango). |
| `fiat_code` | string | Código ISO 4217 (USD, EUR, ARS, VES…). Dimensión de "moneda". |
| `payment_method` | string | Método de pago declarado (texto libre). Dimensión secundaria. |
| `fee` | number | Fee total cobrado al vendedor (sats) = porción bot + porción comunidad. |
| `bot_fee` | number | **Snapshot** de `MAX_FEE` al crear la orden (decimal, p.ej. 0.002). |
| `community_fee` | number | **Snapshot** de `FEE_PERCENT` al crear la orden (decimal, p.ej. 0.7). *Ojo: el nombre engaña, es el % que se queda el bot.* |
| `routing_fee` | number | Fee de ruteo LN realmente pagado al liquidar el pago al comprador (sats). **Costo** del bot. |
| `community_id` | string\|null | Comunidad dueña de la orden (null = orden global/sin comunidad). |
| `creator_id`, `seller_id`, `buyer_id` | string | Referencias a usuarios. PII — no exponer crudo. |
| `created_at` | Date | Fecha de creación. **Eje temporal principal.** |
| `taken_at` | Date\|null | Cuándo se tomó la orden. |
| `invoice_held_at` | Date | Cuándo el vendedor pagó el hold invoice (sats retenidos). |
| `calculated` | boolean | `true` si el job de earnings ya contabilizó esta orden a la comunidad. |
| `is_frozen` / `is_public` | boolean | Flags de estado. |
| `price_from_api` / `price_margin` | boolean/number | Si el precio fue de API y el margen aplicado. |
| `hash` / `secret` | string\|null | Hash/secret del hold invoice. PII/sensible — no exponer. |

#### 3.1.1 Estados (`status` enum) y semántica analítica

| Estado | Significado | Clasificación para dashboard |
|--------|-------------|------------------------------|
| `PENDING` | Publicada, no tomada | **Abierta** (en mercado) |
| `WAITING_PAYMENT` | Esperando que el vendedor pague el hold invoice | **En progreso** |
| `WAITING_BUYER_INVOICE` | Esperando invoice del comprador | **En progreso** |
| `ACTIVE` | Tomada, fondos retenidos en escrow | **En progreso** (sats retenidos) |
| `FIAT_SENT` | Comprador marcó fiat enviado | **En progreso** |
| `PAID_HOLD_INVOICE` | Vendedor liberó; pago al comprador en curso | **En progreso** (saliendo) |
| `SUCCESS` | **Trade completado con éxito** | **Exitosa** ✅ |
| `DISPUTE` | Disputa abierta | **Disputa** |
| `FROZEN` | Congelada por admin | **Disputa/Admin** |
| `CANCELED` | Cancelada por usuario(s) | **Cancelada** |
| `CANCELED_BY_ADMIN` | Cancelada por admin | **Cancelada** |
| `EXPIRED` | Expirada por job | **Expirada** |
| `HOLD_INVOICE_EXPIRED` | Hold invoice expiró antes de cobrar | **Expirada/Fallida** |
| `CLOSED` | Cerrada | **Cerrada** |

> **Agrupaciones sugeridas para UI** (chips de filtro de alto nivel):
> - **Exitosas** = `[SUCCESS]`
> - **Abiertas** = `[PENDING]`
> - **En progreso** = `[WAITING_PAYMENT, WAITING_BUYER_INVOICE, ACTIVE, FIAT_SENT, PAID_HOLD_INVOICE]`
> - **Canceladas** = `[CANCELED, CANCELED_BY_ADMIN]`
> - **Expiradas/Fallidas** = `[EXPIRED, HOLD_INVOICE_EXPIRED]`
> - **Disputas** = `[DISPUTE, FROZEN]`

> ⚠️ **Sesgo de supervivencia en datos históricos:** el job `delete_published_orders`
> **borra físicamente** órdenes `PENDING` viejas (más antiguas que
> `ORDER_PUBLISHED_EXPIRATION_WINDOW`). Por lo tanto el conteo de `PENDING` solo es
> fiable para el presente, no para series históricas. Documentar esto en la UI.

### 3.2 `users`

| Campo | Uso analítico |
|-------|---------------|
| `trades_completed` | Trades exitosos del usuario (ya descontados trades circulares). |
| `volume_traded` | Volumen acumulado en sats. |
| `total_rating`, `total_reviews`, `last_rating`, `reviews[]` | Reputación. |
| `disputes` | N.º de disputas del usuario. |
| `created_at` | Alta del usuario → métrica de crecimiento. |
| `default_community_id` | Comunidad por defecto → membresía. |
| `banned`, `admin` | Flags. |
| `volume_traded`, `show_volume_traded`, `show_username` | Banderas de privacidad del propio usuario. Respetar en vistas públicas. |

### 3.3 `communities`

| Campo | Uso analítico |
|-------|---------------|
| `name`, `_id`, `group`, `currencies[]`, `payment_methods[]` | Dimensión "comunidad". |
| `fee` | % (0–100) que define cuánto de la porción comunitaria toma la comunidad. |
| `earnings` | Sats acumulados pendientes de retiro (alimentado por el job). |
| `orders_to_redeem` | N.º de órdenes ya contabilizadas a la comunidad. |
| `created_at`, `enabled`, `public` | Estado/altas. |
| `solvers[]`, `banned_users[]` | Operación de la comunidad. |

### 3.4 `disputes`

| Campo | Uso |
|-------|-----|
| `status` | `WAITING_FOR_SOLVER`, `IN_PROGRESS`, `SETTLED`, `SELLER_REFUNDED`, `RELEASED`. |
| `community_id`, `order_id`, `solver_id`, `initiator` | Dimensiones. |
| `created_at` | Eje temporal. |

### 3.5 `pendingpayments`

| Campo | Uso |
|-------|-----|
| `paid`, `is_invoice_expired` | Estado del pago saliente. |
| `amount` | Sats. |
| `attempts`, `next_retry` | Reintentos (backoff exponencial). |
| `last_error` | `TIMEOUT`, `ROUTING_FAILED`, `INSUFFICIENT_BALANCE`, `AMOUNT_MISMATCH`, `UNKNOWN`. Salud de pagos. |
| `community_id` | `null` = pago de orden a comprador; no-null = retiro de earnings de comunidad. |
| `created_at`, `paid_at` | Latencia de pago. |

### 3.6 `configs` (estado del nodo)

Un único documento, actualizado cada minuto por el job `node_info`:
`node_status` (`up`/`down`), `node_alias`, `node_version`, `node_block_height`,
`node_channels_count`, `node_peers_count`, `node_synced_to_chain`,
`node_synced_to_graph`, `maintenance`.

> **Limitación:** `configs` **no** contiene saldos de wallet ni de canales. Para
> "liquidez disponible" se requiere o bien consultar LND directamente o crear
> snapshots (ver §9.4, opcional).

---

## 4. Definiciones canónicas de métricas

Estas definiciones son **normativas**: toda la app (backend y frontend) debe
usarlas para evitar discrepancias.

### 4.1 Dimensión temporal

- **Campo de tiempo por defecto:** `orders.created_at`.
- **Alternativas seleccionables** (para análisis avanzado): `taken_at` (cuándo se
  tomó), `invoice_held_at` (cuándo entraron sats). El selector de "campo de fecha"
  es opcional pero recomendado.
- **Granularidades:** `hour`, `day`, `week`, `month`, `year`, `custom range`.
- **Zona horaria:** todas las fechas en DB son UTC. La UI debe permitir elegir TZ
  (por defecto UTC); el bucketing por día/mes se hace con `$dateTrunc`/`$dateToString`
  usando el parámetro `timezone`.

### 4.2 Métricas de órdenes

| Métrica | Definición | Fórmula (conceptual) |
|---------|------------|----------------------|
| **Órdenes creadas** | Conteo de órdenes con `created_at` en el rango. | `count(orders)` |
| **Órdenes exitosas** | Órdenes `SUCCESS` en el rango. | `count(status=SUCCESS)` |
| **Tasa de éxito** | exitosas / (exitosas + canceladas + expiradas). | ver nota* |
| **Órdenes canceladas** | `status ∈ {CANCELED, CANCELED_BY_ADMIN}`. | `count(...)` |
| **Órdenes expiradas** | `status ∈ {EXPIRED, HOLD_INVOICE_EXPIRED}`. | `count(...)` |
| **Órdenes activas (en curso)** | `status ∈ {en progreso}` (snapshot actual). | `count(...)` |
| **Disputas** | desde `disputes` o `status ∈ {DISPUTE, FROZEN}`. | `count(...)` |
| **Volumen (sats)** | suma de `amount` de órdenes `SUCCESS`. | `sum(amount)` |
| **Volumen (fiat)** | suma de `fiat_amount` por `fiat_code` (no sumar entre monedas distintas). | `sum(fiat_amount) group by fiat_code` |
| **Ticket promedio (sats)** | `volumen / nº exitosas`. | `avg(amount)` |
| **Tiempo a completar** | `SUCCESS` ⇒ tiempo desde `created_at`/`taken_at`. | percentiles |

> \* La "tasa de éxito" excluye órdenes en progreso (aún no resueltas). Definir el
> denominador explícitamente en la UI (tooltip). Recomendado:
> `SUCCESS / (SUCCESS + CANCELED + CANCELED_BY_ADMIN + EXPIRED + HOLD_INVOICE_EXPIRED)`.

> ⚠️ **Nunca sumar `fiat_amount` entre monedas distintas.** Siempre agrupar por
> `fiat_code`. Para un total único cross-moneda, convertir todo a sats (ya está en
> `amount`) o a una moneda de referencia vía tasa (no recomendado por consistencia
> histórica).

### 4.3 Ranking de monedas con más operaciones exitosas

Dimensión = `fiat_code`. Por cada moneda en el rango:
- `successful_orders` = `count(status=SUCCESS)`
- `volume_sats` = `sum(amount)`
- `volume_fiat` = `sum(fiat_amount)` (en su propia moneda)
- `avg_ticket_sats`, `unique_traders` (cardinalidad de `buyer_id`∪`seller_id`).

Ordenable por cualquiera de las anteriores; default: `successful_orders` desc.

### 4.4 Métricas financieras (ver §8 para fórmulas exactas)

- **Fees totales cobrados** = `sum(fee)` de órdenes `SUCCESS`.
- **Ingreso del bot** = `sum( (amount * bot_fee) * community_fee )` (órdenes con
  comunidad) + `sum(fee)` (órdenes sin comunidad). Ver matiz en §8.
- **Ganancias de comunidades** = `sum(fee) - ingreso_bot` (porción comunitaria).
- **Costos de ruteo** = `sum(routing_fee)`.
- **Beneficio neto del bot** = `ingreso_bot - costos_ruteo`.

### 4.5 Métricas del nodo (flujo de fondos)

- **Sats entrantes (retenidos)** = `sum(amount)` de órdenes que alcanzaron al menos
  `ACTIVE` (hold invoice pagado) en el rango — ver §9.1.
- **Sats salientes (pagados)** = `sum(amount)` de órdenes `SUCCESS` en el rango.
- **Sats actualmente en escrow** (snapshot) = `sum(amount)` de
  `status ∈ {ACTIVE, FIAT_SENT, PAID_HOLD_INVOICE, DISPUTE, FROZEN}`.
- **Pagos salientes fallidos/pendientes** = desde `pendingpayments`.

---

## 5. Arquitectura del sistema

```
                       ┌─────────────────────────────┐
                       │        Navegador (SPA)       │
                       │  React + Recharts/ECharts    │
                       └───────────┬─────────────────┘
                          HTTPS    │   WSS (tiempo real)
                                   ▼
            ┌──────────────────────────────────────────────┐
            │         Backend Analytics (Node/TS)           │
            │  ┌────────────┐  ┌───────────┐  ┌───────────┐ │
            │  │ REST API   │  │ WS/SSE hub│  │ Auth (JWT)│ │
            │  └─────┬──────┘  └─────┬─────┘  └───────────┘ │
            │  ┌─────▼─────────────────────────────────────┐│
            │  │ Capa de servicios (queries + reconcile)   ││
            │  └─────┬───────────────────┬─────────────────┘│
            │  ┌─────▼──────┐   ┌─────────▼──────────┐       │
            │  │ Caché      │   │ Change Stream      │       │
            │  │ (Redis/mem)│   │ listeners          │       │
            │  └────────────┘   └─────────┬──────────┘       │
            └──────────────────────────────┼────────────────┘
                       read-only  │         │ change streams
                                  ▼         ▼
                       ┌──────────────────────────────┐
                       │   MongoDB (replica set)       │
                       │  orders, users, communities…  │
                       └──────────────────────────────┘
                                  ▲
                                  │ (opcional, §9.4) snapshots de balance
                       ┌──────────┴───────────┐
                       │ LND (read-only macaroon)│
                       └──────────────────────┘
```

### 5.1 Decisiones tecnológicas recomendadas

| Componente | Recomendación | Justificación |
|------------|---------------|---------------|
| Lenguaje backend | **TypeScript + Node.js** | Reutiliza tipos/modelos del bot (`IOrder`, etc.), mismo ecosistema. |
| Framework HTTP | **Fastify** (o Express) | Rápido, buen soporte de schemas/validación. |
| Acceso a datos | **Driver nativo de MongoDB** o Mongoose en modo lectura | Aggregation pipeline. Reutilizar interfaces de `models/`. |
| Tiempo real | **Change Streams + WebSocket** (ws/socket.io) o **SSE** | Requiere replica set (ver §10). |
| Caché | **Redis** (prod) / in-memory LRU (dev) | Cachear agregaciones costosas. |
| Frontend | **React + Vite + TypeScript** | SPA. |
| Gráficas | **ECharts** o **Recharts** | Series temporales, barras, donuts, heatmaps. |
| Auth | **JWT** + login admin, o reverse-proxy con OAuth | Datos sensibles. |
| Programación de tareas | **node-cron** (refresco de caché/rollups) | Igual que el bot usa node-schedule. |

> **Reutilización:** el backend puede importar directamente las interfaces de
> `models/*.ts` del repo (p. ej. publicarlas como paquete o copiar tipos) para
> garantizar que los nombres de campos y enums no se desincronicen.

### 5.2 Estructura de proyecto propuesta (monorepo o repo aparte)

```
analytics/
├── backend/
│   ├── src/
│   │   ├── config/            # env, conexión Mongo (read-only), Redis
│   │   ├── db/                # cliente Mongo, helpers de pipeline
│   │   ├── models/            # tipos compartidos (reflejan models/ del bot)
│   │   ├── services/
│   │   │   ├── orders.service.ts        # métricas de órdenes
│   │   │   ├── currencies.service.ts    # rankings por fiat
│   │   │   ├── node.service.ts          # flujo de fondos / salud nodo
│   │   │   ├── reconcile.service.ts     # conciliación de ganancias
│   │   │   ├── communities.service.ts
│   │   │   └── users.service.ts
│   │   ├── realtime/          # change streams + hub WS
│   │   ├── api/               # rutas REST
│   │   ├── auth/              # JWT, middleware
│   │   └── cache/             # capa de caché + invalidación
│   └── test/
└── frontend/
    └── src/
        ├── api/               # cliente REST + WS
        ├── components/        # gráficos, tablas, filtros
        ├── pages/             # Overview, Orders, Currencies, Node, Finance…
        └── state/             # store de filtros globales
```

---

## 6. Diseño de la API

### 6.1 Convenciones

- Base: `/api/v1`.
- Todos los endpoints aceptan los **filtros comunes** como query params:

| Param | Tipo | Default | Descripción |
|-------|------|---------|-------------|
| `from` | ISO8601 | `-30d` | Inicio del rango (inclusive). |
| `to` | ISO8601 | `now` | Fin del rango (exclusive). |
| `granularity` | enum | `day` | `hour\|day\|week\|month\|year`. |
| `tz` | string | `UTC` | Zona horaria IANA para bucketing. |
| `type` | enum\|csv | (todos) | `buy`, `sell`. |
| `status` | csv | (depende) | Lista de estados o grupos (`success`, `canceled`…). |
| `fiat` | csv | (todas) | Códigos ISO (`USD,EUR,ARS`). |
| `community_id` | string | (todas) | Filtra por comunidad. `none` = sin comunidad. |
| `payment_method` | string | (todos) | Texto. |
| `dateField` | enum | `created_at` | `created_at\|taken_at\|invoice_held_at`. |

- Respuesta estándar:

```jsonc
{
  "data": { /* ... */ },
  "meta": {
    "from": "2026-06-01T00:00:00Z",
    "to": "2026-06-30T00:00:00Z",
    "generatedAt": "2026-06-30T12:00:00Z",
    "cached": true,
    "filtersApplied": { "type": "sell", "fiat": ["USD"] }
  }
}
```

### 6.2 Endpoints REST

#### Resumen / Overview
- `GET /api/v1/overview` — KPIs de cabecera: total órdenes, exitosas, canceladas,
  volumen sats/fiat (top monedas), ingreso del bot, beneficio neto, estado nodo,
  sats en escrow. (Respeta filtros comunes.)

#### Órdenes
- `GET /api/v1/orders/summary` — conteos por estado y por tipo en el rango.
- `GET /api/v1/orders/timeseries` — serie temporal por `granularity` de una
  métrica (`metric=count|volume_sats|volume_fiat|success_rate`), opcionalmente
  desglosada (`groupBy=status|type|fiat`).
- `GET /api/v1/orders/status-breakdown` — distribución por estado (para donut).
- `GET /api/v1/orders/count?status=CANCELED&from=…&to=…` — caso de uso explícito:
  "número de órdenes canceladas en un periodo". (Atajo conveniente.)

#### Monedas (fiat)
- `GET /api/v1/currencies/ranking` — ranking de monedas con más operaciones
  exitosas (parámetro `sortBy=successful_orders|volume_sats|volume_fiat`,
  `limit=N`).
- `GET /api/v1/currencies/:code/timeseries` — evolución de una moneda.

#### Nodo / flujo de fondos
- `GET /api/v1/node/status` — último estado de `configs` (up/down, peers, canales,
  sync, block height, maintenance).
- `GET /api/v1/node/flow` — sats entrantes vs salientes (serie temporal y totales),
  sats en escrow (snapshot), costos de ruteo.
- `GET /api/v1/node/payments-health` — `pendingpayments`: pendientes, fallidos por
  `last_error`, reintentos promedio, latencia de pago.

#### Finanzas / conciliación
- `GET /api/v1/finance/reconciliation` — informe de conciliación (ver §8.4).
- `GET /api/v1/finance/bot-earnings/timeseries` — ingreso del bot por periodo.
- `GET /api/v1/finance/routing-costs/timeseries` — costos de ruteo por periodo.

#### Comunidades
- `GET /api/v1/communities/ranking` — comunidades por volumen/órdenes/earnings.
- `GET /api/v1/communities/:id/overview` — métricas de una comunidad.
- `GET /api/v1/communities/:id/earnings` — earnings acumulados, orders_to_redeem,
  retiros pendientes.

#### Usuarios (agregado, sin PII)
- `GET /api/v1/users/growth` — altas por periodo (`users.created_at`).
- `GET /api/v1/users/leaderboard` — top traders **respetando `show_username` /
  `show_volume_traded`** (ver §12). Por defecto anonimizado.
- `GET /api/v1/users/activity` — usuarios activos (con ≥1 orden) por periodo.

#### Disputas
- `GET /api/v1/disputes/summary` — por estado, por comunidad, tasa de disputa
  (disputas / órdenes en rango).

#### Export
- `GET /api/v1/export/orders.csv` — export filtrado (campos no sensibles).
- `GET /api/v1/export/reconciliation.csv`.

### 6.3 WebSocket / SSE

- `WS /ws` (o `GET /api/v1/stream` para SSE). El cliente se suscribe a canales:
  - `overview` — KPIs recalculados ante cada cambio relevante (con debounce).
  - `orders` — eventos de orden creada/actualizada (delta).
  - `node` — cambios de estado del nodo.
  - `finance` — recálculo de earnings al detectar `SUCCESS` nuevas.

Mensaje de evento:
```jsonc
{
  "channel": "orders",
  "event": "order.updated",
  "payload": { "id": "...", "status": "SUCCESS", "type": "sell", "fiat_code": "USD", "amount": 50000, "delta": { "metric": "successful_orders", "by": 1 } },
  "ts": "2026-06-30T12:00:01Z"
}
```

> El payload de tiempo real **no** incluye PII (sin `buyer_id`/`seller_id`/`hash`).

---

## 7. Catálogo de consultas de agregación

Pipelines de MongoDB listos para implementar. (Pseudocódigo cercano a la sintaxis
real; ajustar nombres de colección — Mongoose pluraliza a `orders`, etc.)

### 7.1 Conteo por estado y tipo (orders/summary)

```js
db.orders.aggregate([
  { $match: { created_at: { $gte: from, $lt: to }, /* ...filtros opcionales... */ } },
  { $group: {
      _id: { status: "$status", type: "$type" },
      count: { $sum: 1 },
      volume_sats: { $sum: "$amount" }
  }},
  { $group: {
      _id: "$_id.status",
      total: { $sum: "$count" },
      byType: { $push: { type: "$_id.type", count: "$count", volume_sats: "$volume_sats" } }
  }}
])
```

### 7.2 Serie temporal de órdenes exitosas por día (orders/timeseries)

```js
db.orders.aggregate([
  { $match: { status: "SUCCESS", created_at: { $gte: from, $lt: to } } },
  { $group: {
      _id: { $dateTrunc: { date: "$created_at", unit: "day", timezone: tz } },
      count: { $sum: 1 },
      volume_sats: { $sum: "$amount" }
  }},
  { $sort: { _id: 1 } }
])
```

> Variante por `granularity`: cambiar `unit` a `hour|week|month|year`. Para series
> con huecos rellenos (días sin órdenes), usar `$densify` (Mongo ≥5.1) o rellenar en
> el backend.

### 7.3 Ranking de monedas con más operaciones exitosas (currencies/ranking)

```js
db.orders.aggregate([
  { $match: { status: "SUCCESS", created_at: { $gte: from, $lt: to } } },
  { $group: {
      _id: "$fiat_code",
      successful_orders: { $sum: 1 },
      volume_sats: { $sum: "$amount" },
      volume_fiat: { $sum: { $ifNull: ["$fiat_amount", 0] } },
      avg_ticket_sats: { $avg: "$amount" },
      traders: { $addToSet: "$buyer_id" }      // aproximación; ver nota
  }},
  { $addFields: { unique_buyers: { $size: "$traders" } } },
  { $project: { traders: 0 } },
  { $sort: { successful_orders: -1 } },
  { $limit: limit }
])
```

> Para `unique_traders` exacto (compradores ∪ vendedores) usar dos `$addToSet`
> (`buyer_id`, `seller_id`) y unir con `$setUnion` antes de `$size`.

### 7.4 "Órdenes canceladas en un periodo" (orders/count)

```js
db.orders.countDocuments({
  status: { $in: ["CANCELED", "CANCELED_BY_ADMIN"] },
  created_at: { $gte: from, $lt: to },
  // ...type, community_id opcionales
})
```

### 7.5 Órdenes activas / en escrow (snapshot, sin filtro temporal)

```js
db.orders.aggregate([
  { $match: { status: { $in: ["ACTIVE","FIAT_SENT","PAID_HOLD_INVOICE","DISPUTE","FROZEN"] } } },
  { $group: { _id: "$status", count: { $sum: 1 }, sats_in_escrow: { $sum: "$amount" } } }
])
```

### 7.6 Flujo de fondos del nodo (node/flow)

**Salientes (pagados) por día:**
```js
db.orders.aggregate([
  { $match: { status: "SUCCESS", created_at: { $gte: from, $lt: to } } },
  { $group: {
      _id: { $dateTrunc: { date: "$created_at", unit: granularity, timezone: tz } },
      out_sats: { $sum: "$amount" },
      routing_fee: { $sum: "$routing_fee" }
  }},
  { $sort: { _id: 1 } }
])
```

**Entrantes (retenidos) por día** — usar `invoice_held_at` y estados que implican
hold pagado (ver §9.1):
```js
db.orders.aggregate([
  { $match: {
      invoice_held_at: { $gte: from, $lt: to, $ne: null },
      status: { $in: ["ACTIVE","FIAT_SENT","PAID_HOLD_INVOICE","SUCCESS","DISPUTE","FROZEN","HOLD_INVOICE_EXPIRED"] }
  }},
  { $group: {
      _id: { $dateTrunc: { date: "$invoice_held_at", unit: granularity, timezone: tz } },
      in_sats: { $sum: "$amount" }
  }},
  { $sort: { _id: 1 } }
])
```

### 7.7 Salud de pagos salientes (node/payments-health)

```js
db.pendingpayments.aggregate([
  { $facet: {
      open:    [ { $match: { paid: false, is_invoice_expired: false } }, { $count: "n" } ],
      expired: [ { $match: { is_invoice_expired: true } }, { $count: "n" } ],
      byError: [ { $match: { paid: false } }, { $group: { _id: "$last_error", n: { $sum: 1 } } } ],
      retries: [ { $group: { _id: null, avgAttempts: { $avg: "$attempts" } } } ]
  }}
])
```

### 7.8 Conciliación / ingreso del bot — ver §8.

---

## 8. Conciliación de ganancias (módulo financiero)

Esta es la sección más delicada: **las fórmulas deben coincidir exactamente con el
código del bot**, o la conciliación no cuadra. A continuación, la lógica real del
repo y cómo replicarla.

### 8.1 Cómo el bot calcula el fee al crear la orden

`util/index.ts → getFee(amount, communityId)`:

```
maxFee = round(amount * MAX_FEE)            // porción total destinada a fees
if (!communityId) return maxFee             // orden sin comunidad: todo es fee del bot
botFee       = maxFee * FEE_PERCENT          // lo que se queda el bot
communityFee = round(maxFee - botFee)        // base de la comunidad
communityFee = communityFee * (community.fee / 100)  // ajuste por % de la comunidad
return botFee + communityFee                 // => se guarda en order.fee
```

Al crear la orden se guardan **snapshots**:
- `order.bot_fee = MAX_FEE` (decimal, p.ej. 0.002)
- `order.community_fee = FEE_PERCENT` (decimal, p.ej. 0.7)
- `order.fee = botFee + communityFee` (sats)

### 8.2 Cómo el bot calcula las ganancias de la comunidad (job)

`jobs/calculate_community_earnings.ts` (corre cada 10 min sobre órdenes
`SUCCESS`, `community_id != null`, `calculated == false`):

```
amount              = order.amount
fee                 = order.fee
botFee              = order.bot_fee      || MAX_FEE
communityFeePercent = order.community_fee || FEE_PERCENT
maxFee       = amount * botFee
communityFee = fee - maxFee * communityFeePercent     // <-- porción de la comunidad
community.earnings        += round(communityFee)
community.orders_to_redeem += 1
order.calculated = true
```

> 🔎 **Matiz importante de conciliación:** la fórmula del *job* para
> `communityFee` es `fee - maxFee * communityFeePercent`, que es el **complemento**
> de la porción del bot. Es decir, el bot considera su ingreso por orden como
> `maxFee * communityFeePercent` = `(amount * bot_fee) * community_fee`, y lo que
> sobra del `fee` total va a la comunidad. **El dashboard debe usar exactamente esta
> definición** para que `Σ ingreso_bot + Σ earnings_comunidad == Σ fee`.

### 8.3 Definiciones financieras canónicas para el dashboard

Por **cada orden `SUCCESS`**:

```
botRevenue_i =
   if (community_id == null):  fee_i                       // sin comunidad: todo el fee es del bot
   else:                       amount_i * bot_fee_i * community_fee_i   // = maxFee * FEE_PERCENT

communityEarnings_i =
   if (community_id == null):  0
   else:                       fee_i - (amount_i * bot_fee_i * community_fee_i)

routingCost_i = routing_fee_i

netProfit_i = botRevenue_i - routingCost_i
```

Agregados en el rango:
```
TotalFees            = Σ fee_i
BotRevenue           = Σ botRevenue_i
CommunityEarnings    = Σ communityEarnings_i
RoutingCosts         = Σ routing_fee_i
BotNetProfit         = BotRevenue - RoutingCosts
```

> **Identidad de control (debe cumplirse):**
> `BotRevenue + CommunityEarnings == TotalFees` (salvo redondeos por orden —
> el bot hace `round()` en varios puntos; tolerar ±1 sat por orden).

### 8.4 Informe de conciliación (finance/reconciliation)

Estructura de respuesta sugerida:

```jsonc
{
  "period": { "from": "...", "to": "..." },
  "orders": { "successful": 1234 },
  "fees": {
    "total_fees_sats": 250000,
    "bot_revenue_sats": 175000,
    "community_earnings_sats": 75000,
    "identity_check": { "expected": 250000, "computed": 250000, "diff": 0, "ok": true }
  },
  "routing": { "routing_costs_sats": 4200 },
  "profit": { "bot_net_profit_sats": 170800 },
  "communities": {
    "accrued_in_db_sats": 73000,         // Σ community.earnings actual
    "computed_from_orders_sats": 75000,  // Σ communityEarnings_i (rango all-time)
    "pending_calculation_sats": 2000,    // órdenes SUCCESS con calculated=false
    "note": "diferencia explicada por job aún no ejecutado / retiros realizados"
  },
  "withdrawals": {
    "pending_sats": 1500,                // Σ pendingpayments(community_id!=null, paid=false)
    "failed": 0
  }
}
```

#### 8.4.1 Verificaciones de integridad incluidas

1. **Identidad de fees:** `BotRevenue + CommunityEarnings ≈ TotalFees`.
2. **Earnings DB vs computado:** comparar `Σ community.earnings` (actual) contra
   `Σ communityEarnings_i` de órdenes `SUCCESS, calculated=true`. Diferencias se
   explican por **retiros ya pagados** (earnings se ponen a 0 al retirar) — por eso
   también hay que sumar retiros históricos pagados.
   - Conciliación completa: `Σ communityEarnings_i (calculated=true)` debería ≈
     `Σ community.earnings (actual)` + `Σ pendingpayments(community, paid=true).amount`.
3. **Órdenes pendientes de cálculo:** `count(SUCCESS, community_id!=null,
   calculated=false)` y su suma — dinero "en tránsito" hacia earnings.
4. **Backlog de pagos:** `pendingpayments(paid=false)` agrupados por `last_error`.

> ⚠️ **No** recomputar earnings escribiendo en la DB. El dashboard solo **lee** y
> **compara**; si detecta descuadres, los reporta como alertas, no los corrige.

### 8.5 Serie temporal de ganancias del bot (finance/bot-earnings/timeseries)

```js
db.orders.aggregate([
  { $match: { status: "SUCCESS", created_at: { $gte: from, $lt: to } } },
  { $addFields: {
      botRevenue: {
        $cond: [
          { $eq: ["$community_id", null] },
          "$fee",
          { $multiply: ["$amount", "$bot_fee", "$community_fee"] }
        ]
      }
  }},
  { $group: {
      _id: { $dateTrunc: { date: "$created_at", unit: granularity, timezone: tz } },
      bot_revenue: { $sum: "$botRevenue" },
      routing_cost: { $sum: "$routing_fee" },
      fees_total: { $sum: "$fee" }
  }},
  { $addFields: { net_profit: { $subtract: ["$bot_revenue", "$routing_cost"] } } },
  { $sort: { _id: 1 } }
])
```

---

## 9. Flujo de fondos del nodo Lightning

### 9.1 Sats entrantes (retenidos en escrow)

Cuando un vendedor paga el hold invoice, los sats quedan **retenidos** en el nodo.
El bot marca esto con `invoice_held_at` y transiciona la orden a `ACTIVE` (o estados
posteriores). Para "monto entrante en el nodo" en un periodo:

- Filtrar por `invoice_held_at` en el rango y `status` que implique que el hold se
  pagó alguna vez: `{ACTIVE, FIAT_SENT, PAID_HOLD_INVOICE, SUCCESS, DISPUTE,
  FROZEN, HOLD_INVOICE_EXPIRED}`. (Ver pipeline §7.6.)
- Sumar `amount`.

> Nota: técnicamente en hold invoices los sats están "en vuelo/retenidos", no
> liquidados, hasta `settle`. Para fines de tablero, "entrante" = monto que el nodo
> retuvo (HTLC aceptado). Aclarar esta semántica en un tooltip.

### 9.2 Sats salientes (pagados a compradores)

Al liquidar el hold invoice, el bot paga el invoice del comprador
(`ln/pay_request.ts → payToBuyer`) y marca la orden `SUCCESS`, guardando
`routing_fee = payment.fee`. "Monto saliente" = `Σ amount` de órdenes `SUCCESS`
(ver §7.6). El costo real de la red es `Σ routing_fee`.

### 9.3 Sats actualmente en escrow (snapshot)

`Σ amount` de `status ∈ {ACTIVE, FIAT_SENT, PAID_HOLD_INVOICE, DISPUTE, FROZEN}`
(§7.5). Indicador de exposición/fondos comprometidos del nodo en este instante.

### 9.4 (Opcional) Liquidez real del nodo — snapshots de LND

El bot **no** almacena saldos de wallet ni de canales (solo `getWalletInfo`, que no
trae balances). Si se quiere mostrar liquidez disponible (capacidad local/remota,
balance on-chain), hay dos opciones:

- **Opción A (recomendada, sin tocar el bot):** el backend de analítica abre su
  propia conexión a LND con un **macaroon de solo lectura** (`readonly.macaroon`) y
  llama periódicamente a `getChannelBalance`, `getChainBalance`, `getChannels`.
  Guardar snapshots en una colección **propia del dashboard** (p. ej.
  `analytics_node_snapshots`) — nunca en las colecciones del bot.
- **Opción B:** proponer al bot un job que persista estos balances en `configs`
  (cambio de código del bot, fuera del alcance de v1 pero documentado como mejora).

Esquema de snapshot propuesto (colección propia):
```jsonc
{
  "_id": ObjectId,
  "ts": ISODate,
  "chain_balance_sats": 0,
  "channel_balance_local_sats": 0,
  "channel_balance_remote_sats": 0,
  "pending_channel_balance_sats": 0,
  "active_channels": 0,
  "inactive_channels": 0,
  "peers": 0,
  "block_height": 0
}
```

### 9.5 Salud del nodo (configs)

Leer el documento de `configs` para: `node_status`, `node_alias`, `node_version`,
`node_block_height`, `node_channels_count`, `node_peers_count`,
`node_synced_to_chain`, `node_synced_to_graph`, `maintenance`. Mostrar como tarjeta
de estado con semáforo (verde si `up` y `synced_to_chain`).

---

## 10. Tiempo real: estrategia

### 10.1 MongoDB Change Streams (recomendado)

El bot usa un bus de eventos **en proceso** (`bot/modules/events`) que **no** es
accesible desde un proceso externo. Por tanto, el dashboard obtiene cambios en
tiempo real vía **Change Streams** de MongoDB.

**Requisito:** MongoDB debe correr como **replica set** (aunque sea de un nodo) para
soportar change streams. Si el despliegue actual es standalone, documentar la
necesidad de convertirlo a replica set de 1 miembro.

Listeners a implementar:
```js
db.collection('orders').watch(
  [ { $match: { 'operationType': { $in: ['insert','update','replace'] } } } ],
  { fullDocument: 'updateLookup' }
)
```
- Ante `insert` o cambio de `status` → emitir delta al hub WS y **invalidar caché**
  de las métricas afectadas (overview, timeseries del día actual, ranking del rango
  vigente).
- `watch` también sobre `communities` (earnings), `configs` (estado nodo),
  `pendingpayments` (salud de pagos), `disputes`.

### 10.2 Estrategia de actualización incremental

Para no recalcular todo en cada evento:
- **Contadores en vivo del día/hora actual:** mantener en memoria/Redis y aplicar
  deltas (+1 a `SUCCESS` de `USD`, +amount al volumen, etc.).
- **Totales históricos (rangos cerrados):** cacheados con TTL; no cambian.
- **Debounce:** agrupar ráfagas de eventos (p. ej. ventana de 1–2 s) antes de
  empujar al cliente.

### 10.3 Fallback sin replica set

Si no se puede habilitar replica set: **polling** del backend (p. ej. cada 5–15 s)
recalculando solo los KPIs "calientes" (día actual) y empujando por WS/SSE.
Documentar que esto es menos eficiente y con mayor latencia.

### 10.4 Resiliencia de change streams

- Persistir el **resume token** para reanudar tras desconexión sin perder eventos.
- Reintentos con backoff ante cierre del stream.
- Health-check del listener; alertar si se cae.

---

## 11. Frontend: vistas, filtros y componentes

### 11.1 Barra de filtros global (persistente en todas las páginas)

- **Selector de rango de fechas** con presets: Hoy, Ayer, Últimos 7/30/90 días,
  Este mes, Mes pasado, Este año, **Personalizado**.
- **Granularidad:** hora/día/semana/mes (se adapta al rango).
- **Tipo de orden:** toggle buy / sell / ambos.
- **Estado:** multiselect con grupos (Exitosas, Canceladas, Expiradas, En progreso,
  Disputas) y estados individuales.
- **Moneda (fiat):** multiselect con búsqueda (97 monedas con precio).
- **Comunidad:** selector (incluye "Sin comunidad" y "Todas").
- **Método de pago:** texto/autocomplete.
- **Zona horaria.**

Los filtros se reflejan en la URL (querystring) para compartir vistas. Estado global
en el store del frontend.

### 11.2 Páginas

#### 11.2.1 Overview (Resumen)
- Tarjetas KPI: Órdenes totales, Exitosas, Tasa de éxito, Volumen (sats),
  Canceladas, En escrow (sats), Ingreso bot, Beneficio neto, Estado del nodo.
- Mini-sparklines en cada tarjeta (tendencia del periodo).
- Gráfico principal: órdenes exitosas vs creadas (serie temporal).
- Donut: distribución por estado.
- Top 5 monedas (mini-ranking).
- **Indicador "EN VIVO"** (parpadea con cada evento WS).

#### 11.2.2 Órdenes
- Serie temporal (selector de métrica: conteo / volumen sats / volumen fiat).
- Desglose apilado por estado o por tipo.
- Tabla de "conteo por estado" con el filtro vigente (resuelve "¿cuántas canceladas
  en este periodo?").
- Heatmap hora-del-día × día-de-semana (actividad).
- Comparativa buy vs sell.

#### 11.2.3 Monedas
- **Ranking de monedas con más operaciones exitosas** (tabla ordenable):
  moneda, nº exitosas, volumen sats, volumen fiat, ticket promedio, traders únicos.
- Gráfico de barras top-N.
- Drill-down: clic en una moneda → su serie temporal y desglose por tipo/estado.
- Treemap de cuota por moneda.

#### 11.2.4 Nodo (Flujo de fondos)
- Tarjeta de estado del nodo (alias, versión, block height, peers, canales, sync).
- Gráfico entrante vs saliente (sats) por periodo.
- Sats en escrow ahora (gauge) con desglose por estado.
- Costos de ruteo por periodo y % sobre volumen.
- Salud de pagos: pendientes, fallidos por tipo de error, reintentos.
- (Si §9.4 habilitado) Liquidez de canales: local/remoto, balance on-chain.

#### 11.2.5 Finanzas / Conciliación
- Informe de conciliación (§8.4) con semáforos de integridad.
- Ingreso del bot vs costos de ruteo vs beneficio neto (serie temporal).
- Earnings por comunidad (tabla) + pendientes de cálculo + retiros pendientes.
- Botón de export CSV/JSON.

#### 11.2.6 Comunidades
- Ranking por volumen/órdenes/earnings.
- Detalle de comunidad: métricas, monedas que opera, solvers, disputas.

#### 11.2.7 Usuarios (agregado)
- Crecimiento de altas (serie temporal).
- Usuarios activos por periodo.
- Leaderboard (anonimizado por defecto; ver §12).
- Distribución de reputación / nº de disputas.

#### 11.2.8 Disputas
- Por estado, por comunidad, tasa de disputa, tiempo de resolución (si derivable).

### 11.3 Componentes reutilizables
- `<KpiCard value trend sparkline />`
- `<TimeSeriesChart metric groupBy />`
- `<RankingTable columns sortable />`
- `<StatusBreakdownDonut />`
- `<FilterBar />` (global)
- `<LiveBadge />` (estado de conexión WS)
- `<NodeStatusCard />`
- `<ReconciliationReport />`

### 11.4 UX
- Estados de carga (skeletons), vacío y error en cada widget.
- Formato de sats (con separador de miles y opción a BTC).
- Formato fiat según `decimal_digits` de `util/fiat.json`.
- Tema claro/oscuro. i18n (es/en como mínimo, alineado a los locales del bot).

---

## 12. Seguridad, autenticación y privacidad

### 12.1 Acceso a datos
- **Usuario MongoDB de solo lectura** dedicado al dashboard (rol `read` sobre la DB
  del bot). Nunca credenciales de escritura.
- Conexión por red privada / túnel; TLS si es remota.

### 12.2 Autenticación de la app
- El dashboard contiene datos sensibles (finanzas, volúmenes, posiblemente PII).
  **No debe ser público sin auth.**
- Opción mínima: login de admin con JWT (usuarios definidos en config del
  dashboard, no en la DB del bot).
- Opción robusta: detrás de reverse proxy con OAuth/SSO o IP allowlist.
- Roles: `viewer` (solo agregados anonimizados) vs `admin` (finanzas + detalle).

### 12.3 Privacidad / PII
Campos **sensibles** que NO deben exponerse en vistas/exports salvo a `admin`, y aun
así con cautela:
- `seller_id`, `buyer_id`, `creator_id`, `tg_id`, `username`, `hash`, `secret`,
  `buyer_invoice`, `*_dispute_token`, `payment_request`.

Reglas:
- **Respetar banderas del usuario:** `users.show_username` y
  `users.show_volume_traded`. El leaderboard solo muestra username/volumen si el
  usuario lo permitió; de lo contrario, anonimizar (p. ej. "Trader #abcd" derivado
  de un hash no reversible).
- Endpoints agregados nunca devuelven IDs crudos.
- Export por defecto excluye columnas PII.

### 12.4 Hardening
- Rate limiting en la API.
- Validación estricta de query params (whitelist de estados, fiat codes, etc.) para
  evitar inyección en pipelines.
- Límites de rango (p. ej. máximo 2 años) y `limit` máximo en rankings.
- CORS restringido al dominio del frontend.
- Auditoría de accesos a finanzas.

---

## 13. Rendimiento, índices y caché

### 13.1 Índices recomendados (en la DB del bot, solo lectura no los crea)

El bot ya define: `{creator_id:1, status:1}`, `{_id:1, status:1}`, índices en
`users.tg_id`, `communities.group`, etc. Para analítica conviene **proponer** (a
aplicar por el operador del bot, no por el dashboard):

```
orders: { status: 1, created_at: 1 }                  // filtros + rango temporal
orders: { fiat_code: 1, status: 1, created_at: 1 }    // ranking de monedas
orders: { community_id: 1, status: 1, created_at: 1 } // por comunidad
orders: { type: 1, status: 1, created_at: 1 }         // por tipo
orders: { invoice_held_at: 1 }                        // flujo entrante
orders: { status: 1, calculated: 1 }                  // conciliación
pendingpayments: { paid: 1, last_error: 1 }
disputes: { status: 1, created_at: 1 }
users: { created_at: 1 }
```

> Los índices se crean con `background: true`. Coordinar con el equipo del bot; el
> dashboard **no** debe crear índices automáticamente en producción sin acuerdo.

### 13.2 Estrategia de caché
- **Rangos cerrados/históricos:** caché con TTL largo (p. ej. 1 h) o indefinido con
  invalidación por evento; los datos pasados no cambian (salvo borrado de `PENDING`).
- **Día/hora actual:** caché corta (s) + actualización por change stream.
- Clave de caché = hash de (endpoint + filtros normalizados).
- Invalidación selectiva ante eventos relevantes (nueva `SUCCESS` invalida overview,
  timeseries del día, ranking del rango vigente, finanzas).

### 13.3 Pre-agregación / rollups (opcional, escala alta)
- Job programado que materializa rollups diarios por (día, fiat, type, status,
  community) en una colección **propia del dashboard** (`analytics_daily_rollups`).
  Las consultas de rangos largos leen rollups; el día actual se calcula en vivo.
- Esto reduce drásticamente la carga si `orders` crece a millones.

### 13.4 Límites operativos
- `allowDiskUse: true` en agregaciones grandes.
- Timeouts de consulta (`maxTimeMS`).
- Paginación en tablas (rankings, listados).

---

## 14. Despliegue y configuración

### 14.1 Variables de entorno del dashboard

```bash
# Conexión DB (solo lectura)
ANALYTICS_MONGO_URI='mongodb://readonly_user:pass@host:27017/p2plnbot?authSource=admin&readPreference=secondaryPreferred'

# Servidor
PORT=4000
NODE_ENV=production
CORS_ORIGIN='https://analytics.example.com'

# Auth
JWT_SECRET='...'
ADMIN_USERS='admin:bcrypt_hash,...'   # o integración OAuth

# Caché
REDIS_URL='redis://localhost:6379'    # opcional

# Tiempo real
ENABLE_CHANGE_STREAMS=true            # requiere replica set

# (Opcional) LND read-only para snapshots de liquidez (§9.4)
LND_READONLY_MACAROON_BASE64=''
LND_CERT_BASE64=''
LND_GRPC_HOST='127.0.0.1:10009'
NODE_SNAPSHOT_INTERVAL_SECONDS=300

# Límites
MAX_RANGE_DAYS=730
DEFAULT_TZ='UTC'
```

### 14.2 Empaquetado
- Backend y frontend en contenedores Docker separados (o uno sirviendo el build
  estático del frontend).
- `docker-compose` para dev (Mongo replica set de 1 nodo + Redis + backend +
  frontend).
- El bot ya se despliega en DigitalOcean (ver `DEPLOY_DIGITALOCEAN.md`); el
  dashboard puede colocarse junto o en infra separada con acceso de red a Mongo.

### 14.3 Observabilidad
- Logs estructurados (winston, como el bot).
- Métricas del propio dashboard (latencia de endpoints, hit ratio de caché, estado
  del change stream).
- Health endpoint `GET /healthz` (incluye estado de conexión Mongo y change stream).

---

## 15. Plan de implementación por fases

### Fase 0 — Cimientos (1 sprint)
- Conexión Mongo read-only, tipos compartidos con `models/`, scaffolding
  backend (Fastify) + frontend (Vite/React), auth básica JWT, CI.
- `GET /healthz`, `GET /node/status`.

### Fase 1 — Métricas core de órdenes (1–2 sprints)
- `orders/summary`, `orders/timeseries`, `orders/status-breakdown`,
  `orders/count`.
- FilterBar global + página Overview + página Órdenes.
- Definir y testear todas las métricas de §4.2.

### Fase 2 — Monedas (1 sprint)
- `currencies/ranking` + drill-down.
- Página Monedas (ranking + barras + treemap).

### Fase 3 — Nodo y flujo de fondos (1–2 sprints)
- `node/flow`, `node/payments-health`, snapshot en escrow.
- Página Nodo. (Opcional §9.4: snapshots LND read-only.)

### Fase 4 — Finanzas / conciliación (1–2 sprints)
- `finance/reconciliation`, series de ingreso/beneficio.
- Página Finanzas con verificaciones de integridad. **Tests de conciliación
  exhaustivos** (clave del proyecto).

### Fase 5 — Tiempo real (1 sprint)
- Change streams + hub WS/SSE + actualización incremental + LiveBadge.
- Fallback de polling si no hay replica set.

### Fase 6 — Comunidades, usuarios, disputas, export (1–2 sprints)
- Páginas restantes, export CSV/JSON, refinamiento de privacidad.

### Fase 7 — Rendimiento y hardening (1 sprint)
- Caché Redis, rollups opcionales, índices propuestos, rate limiting, auditoría.

---

## 16. Pruebas

### 16.1 Unitarias
- **Cálculos financieros (críticos):** dado un conjunto de órdenes sintéticas con
  `amount`, `bot_fee`, `community_fee`, `fee`, verificar que `botRevenue`,
  `communityEarnings`, `netProfit` coinciden con la lógica del bot (§8). Incluir
  casos con y sin comunidad, y comprobar la **identidad de control**.
- Bucketing temporal por TZ y granularidad.
- Normalización/validación de filtros.

### 16.2 Integración
- Levantar Mongo de prueba (replica set 1 nodo), sembrar datos representativos
  (todos los estados, varias monedas, comunidades), y validar cada endpoint contra
  resultados esperados calculados de forma independiente.
- Reusar utilidades de test del bot si aplica (Mocha/Chai ya están en el repo).

### 16.3 Conciliación contra el bot
- Tomar un snapshot real (anonimizado) y comparar `Σ community.earnings` del bot con
  el computado por el dashboard; documentar y explicar cualquier diferencia
  (retiros, redondeos, órdenes `calculated=false`).

### 16.4 Tiempo real
- Simular inserts/updates en `orders` y verificar que el delta llega al cliente y
  que la caché se invalida correctamente.

### 16.5 E2E / UI
- Flujos de filtro (cambiar rango/estado/moneda y ver consistencia).
- Pruebas de privacidad: usuarios con `show_username=false` no aparecen
  identificados.

---

## 17. Anexos

### 17.1 Mapa campo → métrica (resumen rápido)

| Pregunta del usuario | Fuente | Filtro / fórmula |
|----------------------|--------|------------------|
| Monedas con más operaciones exitosas | `orders` | `status=SUCCESS`, group by `fiat_code`, sort count desc (§7.3) |
| Estadísticas diarias / mensuales | `orders` | `$dateTrunc` por `day`/`month` (§7.2) |
| Por rango de tiempo elegido | `orders` | `created_at ∈ [from,to)` |
| Filtro por tipo de orden | `orders` | `type ∈ {buy,sell}` |
| Nº de canceladas en un periodo | `orders` | `status ∈ {CANCELED,CANCELED_BY_ADMIN}` (§7.4) |
| Órdenes activas | `orders` | snapshot estados "en progreso" (§7.5) |
| Monto entrante en el nodo | `orders` | `invoice_held_at` + estados con hold pagado (§7.6) |
| Monto saliente | `orders` | `status=SUCCESS`, `Σ amount` (§7.6) |
| Conciliación y ganancias | `orders`,`communities`,`pendingpayments` | §8 |
| Estado del nodo | `configs` | documento único |
| Salud de pagos salientes | `pendingpayments` | §7.7 |

### 17.2 Enumeraciones de referencia

- **Order.status:** `WAITING_PAYMENT, WAITING_BUYER_INVOICE, PENDING, ACTIVE,
  FIAT_SENT, CLOSED, DISPUTE, CANCELED, SUCCESS, PAID_HOLD_INVOICE,
  CANCELED_BY_ADMIN, EXPIRED, FROZEN, HOLD_INVOICE_EXPIRED`.
- **Order.type:** `buy, sell`.
- **Dispute.status:** `WAITING_FOR_SOLVER, IN_PROGRESS, SETTLED, SELLER_REFUNDED,
  RELEASED`.
- **PendingPayment.last_error:** `TIMEOUT, ROUTING_FAILED, INSUFFICIENT_BALANCE,
  AMOUNT_MISMATCH, UNKNOWN` (más `''` por defecto).
- **Fiat codes:** 97 monedas con `price:true` en `util/fiat.json` (USD, EUR, ARS,
  VES, COP, BRL, MXN, …).

### 17.3 Variables de entorno del bot relevantes para fórmulas

| Var | Significado | Uso en dashboard |
|-----|-------------|------------------|
| `MAX_FEE` | Fee máximo del bot (decimal, p.ej. 0.002) | Snapshot en `order.bot_fee`; fallback en conciliación |
| `FEE_PERCENT` | % del fee que se queda el bot (p.ej. 0.7) | Snapshot en `order.community_fee`; fallback |
| `MAX_ROUTING_FEE` | Fee máx. de ruteo (p.ej. 0.001) | Contexto para validar `routing_fee` |
| `PENDING_PAYMENT_WINDOW` | Minutos entre reintentos | Interpretar latencia de pagos |
| `ORDER_PUBLISHED_EXPIRATION_WINDOW` | Expiración de publicadas | Explica borrado de `PENDING` |

### 17.4 Riesgos y notas

- **Replica set:** change streams lo requieren. Verificar el despliegue actual.
- **Borrado físico de `PENDING`:** las series históricas de órdenes "abiertas" están
  sesgadas. Avisar en UI.
- **Redondeos:** el bot hace `round()` en fees/earnings; tolerar ±1 sat por orden en
  conciliaciones.
- **`community_fee` mal nombrado:** representa el % del bot (`FEE_PERCENT`), no el de
  la comunidad. No confundir al implementar §8.
- **Sin balances de wallet en DB:** liquidez real requiere LND read-only (§9.4).
- **PII:** respetar `show_username`/`show_volume_traded` y rol `admin` para finanzas.

---

*Fin del documento.*
