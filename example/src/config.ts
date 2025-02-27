interface Config {
  ENVIRONMENT: string;
  PHOENIXSTORE_PROTOCOL: string;
  PHOENIXSTORE_HOST: string;
  PHOENIXSTORE_PORT: number;
  PHOENIXSTORE_PUBLIC_URL: string;
  WEBSOCKET_PROTOCOL: string;
  WEBSOCKET_HOST: string;
  WEBSOCKET_PORT: number;
  WEBSOCKET_PUBLIC_URL: string;
  STORAGE_PUBLIC_PROTOCOL: string;
  STORAGE_PUBLIC_HOST: string;
  STORAGE_PUBLIC_PORT: number;
  STORAGE_PUBLIC_URL: string;
}

const buildUrl = (protocol: string, host: string, port: string | number): string => {
  if (!protocol || !host) {
    throw new Error('Protocol and host are required for URL construction');
  }
  const portStr = String(port);
  if ((portStr === '80' && protocol === 'http') || (portStr === '443' && protocol === 'https')) {
    return `${protocol}://${host}`;
  }
  return `${protocol}://${host}:${portStr}`;
};

// Use import.meta.env (Bun supports this) or process.env, resolved at build time
const config: Config = {
  ENVIRONMENT: (import.meta.env?.ENVIRONMENT as string) || 'development',
  PHOENIXSTORE_PROTOCOL: (import.meta.env?.PHOENIXSTORE_PROTOCOL as string) || 'http',
  PHOENIXSTORE_HOST: (import.meta.env?.PHOENIXSTORE_HOST as string) || 'phoenixstore',
  PHOENIXSTORE_PORT: parseInt((import.meta.env?.PHOENIXSTORE_PORT as string) || '3000', 10),
  PHOENIXSTORE_PUBLIC_URL: buildUrl(
    (import.meta.env?.PHOENIXSTORE_PROTOCOL as string) || 'http',
    (import.meta.env?.PHOENIXSTORE_PUBLIC_HOST as string) || 'localhost',
    (import.meta.env?.PHOENIXSTORE_PUBLIC_PORT as string) || '3000'
  ),
  WEBSOCKET_PROTOCOL: (import.meta.env?.WEBSOCKET_PROTOCOL as string) || 'ws',
  WEBSOCKET_HOST: (import.meta.env?.WEBSOCKET_HOST as string) || 'phoenixstore',
  WEBSOCKET_PORT: parseInt((import.meta.env?.WEBSOCKET_PORT as string) || '3001', 10),
  WEBSOCKET_PUBLIC_URL: buildUrl(
    (import.meta.env?.WEBSOCKET_PROTOCOL as string) || 'ws',
    (import.meta.env?.WEBSOCKET_PUBLIC_HOST as string) || 'localhost',
    (import.meta.env?.WEBSOCKET_PUBLIC_PORT as string) || '3001'
  ),
  STORAGE_PUBLIC_PROTOCOL: (import.meta.env?.STORAGE_PUBLIC_PROTOCOL as string) || 'http',
  STORAGE_PUBLIC_HOST: (import.meta.env?.STORAGE_PUBLIC_HOST as string) || 'minio',
  STORAGE_PUBLIC_PORT: parseInt((import.meta.env?.STORAGE_PUBLIC_PORT as string) || '9000', 10),
  STORAGE_PUBLIC_URL: buildUrl(
    (import.meta.env?.STORAGE_PUBLIC_PROTOCOL as string) || 'http',
    (import.meta.env?.STORAGE_PUBLIC_HOST as string) || 'localhost',
    (import.meta.env?.STORAGE_PUBLIC_PORT as string) || '9000'
  ),
};

// Debug output (use a non-minified build to see this)
// if (typeof window !== 'undefined') {
//   console.log('Config:', config);
// }

export { config };