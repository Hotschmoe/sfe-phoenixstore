# Build stage
FROM oven/bun:1 AS builder

WORKDIR /app

# Copy package files
COPY package.json tsconfig.json ./

# Install dependencies
RUN bun install

# Copy source files
COPY . .

# Set build-time environment variables with defaults
# ENV NODE_ENV=development

# Build the application
RUN bun run build

# Serve stage
FROM oven/bun:1-slim

WORKDIR /app

# Create a non-root user and switch to it
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 bunjs && \
    chown -R bunjs:nodejs /app

# Copy built files, server, and package.json
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/src/server.ts ./src/
COPY --from=builder /app/package.json .

# Change ownership and switch to non-root user
RUN chown -R bunjs:nodejs /app
USER bunjs

EXPOSE 80

# Use shell form for better signal handling and logging
CMD set -x && \
    echo '[Frontend] Starting server...' && \
    exec bun start