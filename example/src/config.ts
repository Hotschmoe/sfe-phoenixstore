// Default values for development
const defaults = {
    API_URL: 'http://localhost:3000',
    WEBSOCKET_URL: 'ws://localhost:3001'
};

export const config = {
    PHOENIXSTORE_URL: process.env.PHOENIXSTORE_URL || defaults.API_URL,
    PHOENIXSTORE_WEBSOCKET: process.env.PHOENIXSTORE_WEBSOCKET || defaults.WEBSOCKET_URL
}; 