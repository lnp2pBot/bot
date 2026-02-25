# Monitoring System

## Overview

The bot includes a push-based monitoring system that sends periodic heartbeat
messages to an external monitor service. This allows administrators to detect
issues within 2-6 minutes without modifying the bot's core architecture.

The heartbeat contains health data about the bot's critical subsystems:
- **Process**: uptime, memory usage, PID
- **MongoDB**: connection state
- **Lightning Network**: node status, channels, sync state

## Architecture

```text
┌──────────────┐    heartbeat     ┌──────────────────┐    alert    ┌──────────┐
│   lnp2pBot   │ ──── POST ────► │  Monitor Service  │ ─────────► │ Telegram │
│ (monitoring) │   every 2 min   │ (lnp2pbot-monitor)│            │  Admins  │
└──────────────┘                  └──────────────────┘            └──────────┘
```

The bot pushes health data to the monitor service. If heartbeats stop arriving,
the monitor detects the silence and sends alerts via Telegram.

## Configuration

Add the following variables to your `.env` file:

| Variable | Description | Default |
|---|---|---|
| `MONITOR_URL` | Monitor service URL (e.g. `https://monitor.example.com`) | _(empty = disabled)_ |
| `MONITOR_AUTH_TOKEN` | Bearer token for authentication | _(empty = no auth)_ |
| ~~`MONITOR_INTERVAL_MS`~~ | _(removed — uses node-schedule cron: every 2 min)_ | — |
| `MONITOR_BOT_NAME` | Bot identifier sent with heartbeats | `lnp2pBot` |

### Enabling monitoring

1. Deploy the [lnp2pbot-monitor](https://github.com/lnp2pBot/lnp2pbot-monitor) service
2. Set `MONITOR_URL` and `MONITOR_AUTH_TOKEN` in your `.env`
3. Restart the bot

### Disabling monitoring

Leave `MONITOR_URL` empty or unset. The bot will log a message at startup
confirming monitoring is disabled and will not attempt any heartbeat requests.

## Heartbeat payload

```json
{
  "bot": "lnp2pBot",
  "timestamp": 1708700000000,
  "uptime": 86400,
  "processId": 1234,
  "nodeEnv": "production",
  "memory": {
    "rss": 104857600,
    "heapTotal": 52428800,
    "heapUsed": 41943040,
    "external": 2097152
  },
  "dbConnected": true,
  "dbState": "connected",
  "lightningConnected": true,
  "lightningInfo": {
    "alias": "lnp2pbot-node",
    "active_channels_count": 15,
    "peers_count": 10,
    "synced_to_chain": true,
    "synced_to_graph": true,
    "block_height": 830000,
    "version": "0.17.0"
  }
}
```

## Failure handling

- Monitoring failures never crash the bot. All errors are caught and logged as warnings.
- If the monitor service is unreachable, the bot continues operating normally.
- HTTP timeouts are set to 10 seconds per request.
- Heartbeat scheduling uses `node-schedule` (cron: `*/2 * * * *`), consistent with the rest of the codebase. Cleanup is handled by `node-schedule`'s `gracefulShutdown()`.

## Related

- Monitor service: [lnp2pBot/lnp2pbot-monitor](https://github.com/lnp2pBot/lnp2pbot-monitor)
- Issue: [#752](https://github.com/lnp2pBot/bot/issues/752)
