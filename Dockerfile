# Development stage
FROM oven/bun:latest as development
WORKDIR /src
# COPY package.json bun.lockb ./
COPY package.json ./
RUN bun install
COPY . .
CMD ["bun", "run", "dev"]

# Production stage
FROM oven/bun:latest as production
WORKDIR /src
# COPY package.json bun.lockb ./
COPY package.json ./
RUN bun install --production
COPY . .
RUN bun run build
CMD ["bun", "run", "start"] 