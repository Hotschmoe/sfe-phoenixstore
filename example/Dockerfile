# Build stage
FROM oven/bun:1 AS builder

WORKDIR /app

# Copy package files
COPY package.json tsconfig.json ./

# Install dependencies
RUN bun install

# Copy source files and static assets
COPY . .

# Build the application
RUN mkdir -p dist && \
    bun run build && \
    cp index.html dist/

# Serve stage
FROM nginx:alpine

# Copy nginx configuration
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copy built files to nginx
COPY --from=builder /app/dist /usr/share/nginx/html

# Verify the content was copied
RUN ls -la /usr/share/nginx/html && \
    echo "Content of /usr/share/nginx/html:" && \
    cat /usr/share/nginx/html/index.html

EXPOSE 80

# Use default nginx command
CMD ["nginx", "-g", "daemon off;"]