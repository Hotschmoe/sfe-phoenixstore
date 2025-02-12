# Development stage
FROM oven/bun:latest as development
WORKDIR /app
COPY package.json bun.lockb ./
RUN bun install
COPY . .
CMD ["bun", "run", "dev"]

# Production stage
FROM oven/bun:latest as production
WORKDIR /app
COPY package.json bun.lockb ./
RUN bun install --production
COPY . .
RUN bun run build
CMD ["bun", "run", "start"] 