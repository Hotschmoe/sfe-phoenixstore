# Build stage
FROM oven/bun:1 as builder

WORKDIR /app

# Install svelte and other dependencies
COPY package.json .
RUN bun init -y && \
    bun add svelte svelte-preprocess typescript @tsconfig/svelte && \
    bun add -d @rollup/plugin-typescript rollup-plugin-svelte

# Copy source files
COPY src ./src
COPY tsconfig.json rollup.config.js ./

# Build the application
RUN bun run build

# Serve stage
FROM nginx:alpine

# Copy nginx configuration
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copy built files from builder
COPY --from=builder /app/public /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
