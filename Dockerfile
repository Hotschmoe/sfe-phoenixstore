# Development stage
FROM oven/bun:latest AS development
WORKDIR /app
COPY package.json bun.lock ./
RUN bun install
COPY . .
ENV NODE_ENV=development

# Use shell form to ensure proper signal handling and logging
CMD set -x && \
    echo '[Development] Starting application...' && \
    exec bun --smol src/index.ts

# Production stage
FROM oven/bun:latest AS production
WORKDIR /app
COPY package.json bun.lock ./
RUN bun install --production
COPY . .
ENV NODE_ENV=production

# Use shell form to ensure proper signal handling and logging
CMD set -x && \
    echo '[Production] Starting application...' && \
    exec bun --smol src/index.ts