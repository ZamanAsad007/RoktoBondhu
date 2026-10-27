# Multi-stage Dockerfile for Notification Service
# Stage 1: Dependencies
FROM node:20-alpine AS deps
WORKDIR /app
COPY package*.json ./
COPY services/notification-service/package*.json ./services/notification-service/
RUN npm ci --workspace=services/notification-service --omit=dev

# Stage 2: Production Runtime
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production

# Copy installed dependencies and source code
COPY --from=deps /app/node_modules ./node_modules
COPY services/notification-service ./services/notification-service
COPY package.json ./

# Run as non-root user
USER node

HEALTHCHECK --interval=20s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "require('ioredis'); process.exit(0);" || exit 1

WORKDIR /app/services/notification-service
CMD ["node", "src/index.js"]
