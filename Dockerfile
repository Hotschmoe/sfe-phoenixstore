# Development stage
FROM oven/bun:latest as development
WORKDIR /app
COPY package.json bun.lockb ./
RUN bun install
COPY . .
ENV NODE_ENV=development
CMD ["bun", "--hot", "./src/index.ts"]

# Production stage
FROM oven/bun:latest as production
WORKDIR /app
COPY package.json bun.lockb ./
RUN bun install --production
COPY . .
ENV NODE_ENV=production
RUN bun build ./src/index.ts --outdir ./dist
CMD ["bun", "./dist/index.js"] 