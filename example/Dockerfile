# Build stage
FROM oven/bun:1 as builder

WORKDIR /app

# Copy package files
COPY package.json .
# Install all dependencies including devDependencies
RUN bun install --frozen-lockfile || exit 1
# Install necessary build dependencies
RUN bun add -d tslib @types/node svelte @rollup/plugin-node-resolve rollup-plugin-svelte rollup-plugin-css-only @rollup/plugin-commonjs || exit 1

# Copy source files
COPY . .

# Build the application
RUN bun run build || exit 1

# Serve stage
FROM nginx:alpine

# Copy nginx configuration
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copy built files from builder
COPY --from=builder /app/public /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]