# Build stage
FROM oven/bun:1 AS builder

WORKDIR /app

# Copy package files, .env, and index.html
COPY package.json tsconfig.json .env index.html ./

# Install dependencies
RUN bun install

# Copy source files
COPY . .

# Build the application and ensure index.html is in dist/
RUN bun run build && cp index.html dist/

# Serve stage
FROM nginx:alpine

# Copy Nginx configuration
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copy built files (including index.html) to Nginx
COPY --from=builder /app/dist /usr/share/nginx/html

# Expose port 80
EXPOSE 80

# Use default Nginx command
CMD ["nginx", "-g", "daemon off;"]