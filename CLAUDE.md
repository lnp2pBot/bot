# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

LNp2pBot is a Telegram bot that facilitates peer-to-peer Lightning Network trading. Users can create buy/sell orders for Bitcoin using Lightning Network hold invoices to ensure trustless transactions.

## Development Commands

### Build and Run
```bash
npm start          # Compile TypeScript and start bot
npm run dev        # Compile and start with nodemon for development
npm run prestart   # Compile TypeScript only
npm run predev     # Compile TypeScript only
```

### Code Quality
```bash
npm run lint       # ESLint code validation
npm run format     # Format code with Prettier
```

### Testing
```bash
npm test           # Run all tests with Mocha
npm run pretest    # Compile tests only
```

## Architecture

### Core Structure
- **app.ts**: Main entry point, handles MongoDB connection and bot initialization
- **bot/**: Bot logic and command handlers
  - **start.ts**: Bot initialization, command registration, and scheduled jobs
  - **modules/**: Feature-specific modules (community, orders, dispute, etc.)
  - **middleware/**: Authentication, validation, and context enhancement
- **models/**: MongoDB schemas (User, Order, Community, Dispute, etc.)
- **ln/**: Lightning Network integration (hold invoices, payments, subscriptions)
- **jobs/**: Scheduled background tasks for order management and payments
- **util/**: Shared utilities and helpers

### Key Patterns

#### Context Enhancement
The bot uses custom context types that extend Telegraf's base context:
- `MainContext`: Adds i18n, user, and admin properties
- `CommunityContext`: Extends MainContext for community-specific features

#### Module Structure
Each feature module follows this pattern:
- `commands.ts`: Command handlers
- `actions.ts`: Action button handlers  
- `messages.ts`: Message templates
- `scenes.ts`: Multi-step conversation flows
- `index.ts`: Module configuration and exports

#### Hold Invoice Pattern
The bot uses Lightning Network hold invoices for trustless escrow:
1. Seller creates order
2. Buyer takes order, seller pays hold invoice
3. Funds are held until both parties confirm fiat exchange
4. Hold invoice is settled or canceled based on dispute resolution

#### Job Scheduling
Background jobs handle critical functions:
- Pending payment retries
- Order expiration and cleanup
- Community earnings calculation
- Node health monitoring

### Database Models
- **User**: Telegram users with trading history and preferences
- **Order**: Trading orders with status tracking and dispute handling
- **Community**: Telegram groups with custom fee structures
- **Dispute**: Conflict resolution with solver assignment
- **PendingPayment**: Failed payment retry queue

### Environment Setup
Copy `.env-sample` to `.env` and configure:
- `BOT_TOKEN`: Telegram bot API token
- `LND_*`: Lightning Network node connection details
- `DB_*` or `MONGO_URI`: MongoDB connection
- `CHANNEL`: Public order announcement channel
- `ADMIN_CHANNEL`: Admin notifications

### Testing
Tests are in TypeScript and use Mocha with Chai assertions. Test compilation uses a separate tsconfig.test.json that includes the tests directory.

```bash
npm test                    # Run all tests
npm run pretest            # Compile tests only
export NODE_ENV=test && mocha --exit 'dist/tests/**/*.spec.js'  # Run specific test pattern
```

### Key Architectural Details

#### Lightning Network Hold Invoice Flow
Two distinct trading patterns:

**Sell Orders (Seller has Bitcoin)**:
1. Seller creates order → Published to channel
2. Buyer takes order → Seller pays hold invoice (funds locked)
3. Buyer sends fiat → Seller confirms receipt
4. Hold invoice settled → Buyer receives Bitcoin

**Buy Orders (Buyer wants Bitcoin)**:
1. Buyer creates order → Published to channel  
2. Seller takes order → Seller pays hold invoice (funds locked)
3. Buyer provides invoice → Seller sends fiat
4. Buyer confirms fiat receipt → Hold invoice settled → Buyer receives Bitcoin

#### Context Types and Middleware Chain
- **MainContext**: Base context with i18n, user, admin properties
- **CommunityContext**: Extends MainContext with wizard state for multi-step flows
- Middleware chain: User validation → Admin checking → Context enhancement → Command routing

#### Job Scheduling Intervals
Critical background processes with specific timing:
- **Pending payments**: Every 5 minutes (configurable via `PENDING_PAYMENT_WINDOW`)
- **Order cancellation**: Every 20 seconds
- **Order deletion**: Every hour at 25 minutes past
- **Community earnings**: Every 10 minutes
- **Node health**: Every minute
- **Solver availability**: Daily at midnight

#### Multi-language Support
- 10 supported languages via YAML files in `locales/`
- User-specific language preferences stored in database
- Dynamic language switching with `@grammyjs/i18n`
- Message templates with interpolation support

### Database Schema Patterns

#### Order Status Lifecycle
Orders follow specific state transitions:
- PENDING → ACTIVE → FIAT_SENT → COMPLETED
- Dispute states: DISPUTE, CANCELED_BY_ADMIN
- Failed states: EXPIRED, CANCELED

#### Community Features
- Custom fee structures per Telegram group
- Solver assignment and dispute resolution
- Automated earnings calculation and distribution
- Ban management (global and community-level)

### Development Patterns

#### Error Handling
- Winston logger with configurable levels and timeout monitoring
- Global unhandled rejection handlers in app.ts
- Try-catch blocks throughout with proper error context
- Graceful shutdown handling (SIGINT/SIGTERM)

#### TypeScript Configuration
- Strict mode enabled for better type safety
- Separate test configuration (tsconfig.test.json)
- Comprehensive interface definitions for all models
- Custom type extensions for Telegraf contexts

### Key Dependencies
- **telegraf**: Telegram bot framework (4.8.0)
- **mongoose**: MongoDB ODM (6.13.6)  
- **lightning**: LND node integration (10.25.0)
- **node-schedule**: Cron job scheduling
- **@grammyjs/i18n**: Internationalization
- **winston**: Logging with timeout monitoring
- **canvas**: QR code generation with random backgrounds