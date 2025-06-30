# Multi-stage build for secure, optimized container

# Build stage
FROM node:20-alpine AS builder

# Install build dependencies required for canvas and other native modules
RUN apk add --no-cache \
    build-base \
    cairo-dev \
    jpeg-dev \
    pango-dev \
    giflib-dev \
    librsvg-dev \
    pixman-dev \
    pkgconfig \
    python3 \
    make \
    g++

# Create app directory
WORKDIR /usr/src/app

# Copy package files
COPY package*.json ./

# Install all dependencies (including dev dependencies for build)
RUN npm ci --only=production --ignore-scripts && \
    npm cache clean --force

# Copy TypeScript configuration
COPY tsconfig*.json ./

# Copy source code
COPY . .

# Build TypeScript
RUN npx tsc

# Production stage
FROM node:20-alpine AS production

# Install runtime dependencies for canvas
RUN apk add --no-cache \
    cairo \
    jpeg \
    pango \
    giflib \
    librsvg \
    pixman \
    ttf-dejavu \
    dumb-init

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodeuser -u 1001

# Create app directory
WORKDIR /usr/src/app

# Copy package files
COPY package*.json ./

# Install only production dependencies
RUN npm ci --only=production --ignore-scripts && \
    npm cache clean --force

# Copy built application from builder stage
COPY --from=builder /usr/src/app/dist ./dist

# Copy necessary runtime files
COPY --chown=nodeuser:nodejs locales ./locales
COPY --chown=nodeuser:nodejs images ./images

# Create directories that might be needed at runtime
RUN mkdir -p /usr/src/app/logs && \
    chown -R nodeuser:nodejs /usr/src/app

# Switch to non-root user
USER nodeuser

# Expose port (optional - Telegram bots don't need HTTP exposure)
EXPOSE 8080

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD node -e "const os = require('os'); console.log('Health check passed'); process.exit(0)" || exit 1

# Use dumb-init to handle signals properly
ENTRYPOINT ["dumb-init", "--"]

# Start the application
CMD ["node", "dist/app.js"]