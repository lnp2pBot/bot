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
    g++ \
    git

# Create app directory
WORKDIR /usr/src/app

# Copy package files
COPY package*.json ./

# Install all dependencies and rebuild native modules
RUN npm ci && \
    npm rebuild canvas && \
    npm cache clean --force

# Copy TypeScript configuration
COPY tsconfig*.json ./

# Copy source code
COPY . .

# Build TypeScript
RUN npx tsc

# Capture git commit hash for version info
RUN git rev-parse HEAD > /tmp/git-commit-hash 2>/dev/null || echo "unknown" > /tmp/git-commit-hash

# Remove dev dependencies after build to reduce final image size
RUN rm -rf node_modules && npm ci --omit=dev

# Production stage
FROM node:20-alpine AS production

# Install runtime dependencies for canvas and git for version info
RUN apk add --no-cache \
    cairo \
    jpeg \
    pango \
    giflib \
    librsvg \
    pixman \
    ttf-dejavu \
    dumb-init \
    git

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodeuser -u 1001

# Create app directory
WORKDIR /usr/src/app

# Copy built application and dependencies from builder stage
COPY --from=builder /usr/src/app/dist ./dist
COPY --from=builder /usr/src/app/node_modules ./node_modules
COPY --from=builder /usr/src/app/package*.json ./
COPY --from=builder /tmp/git-commit-hash /tmp/git-commit-hash

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