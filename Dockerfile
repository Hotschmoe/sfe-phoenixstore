# Development stage
FROM oven/bun:latest as development
WORKDIR /app
COPY package.json bun.lock ./
RUN bun install
COPY . .
ENV NODE_ENV=development
# Add debugging steps
RUN ls -la
RUN echo "Content of src directory:" && ls -la src/

# Use shell form to ensure proper signal handling and logging
CMD set -x && \
    echo 'Starting application...' && \
    exec bun --smol src/index.ts

# Production stage
FROM oven/bun:latest as production
WORKDIR /app
COPY package.json bun.lock ./
RUN bun install --production
COPY . .
ENV NODE_ENV=production
RUN bun build src/index.ts --outdir ./dist
CMD ["bun", "dist/index.js"] 