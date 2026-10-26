# Multi-stage Dockerfile for Core API
# Stage 1: Dependencies and Build
FROM node:20-alpine AS deps
WORKDIR /app
COPY package*.json ./
COPY services/core-api/package*.json ./services/core-api/
RUN npm ci --workspace=services/core-api --omit=dev

# Stage 2: Production Runtime
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=5000

# Install wget for healthcheck
RUN apk add --no-cache wget

# Copy installed dependencies and source code
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/services/core-api/node_modules ./services/core-api/node_modules
COPY services/core-api ./services/core-api
COPY package.json ./

# Run as non-root user
USER node

EXPOSE 5000

HEALTHCHECK --interval=15s --timeout=5s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:5000/health || exit 1

WORKDIR /app/services/core-api
CMD ["node", "src/server.js"]
