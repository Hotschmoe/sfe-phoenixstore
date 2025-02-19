# Build stage
FROM oven/bun:1 as builder

WORKDIR /app

COPY package.json .
RUN bun install || exit 1

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