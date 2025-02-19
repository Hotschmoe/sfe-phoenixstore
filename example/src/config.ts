// Default values for development
const defaults = {
    API_URL: 'http://localhost:3000',
    WEBSOCKET_URL: 'ws://localhost:3001'
};

export const config = {
    API_URL: process.env.API_URL || defaults.API_URL,
    WEBSOCKET_URL: process.env.WEBSOCKET_URL || defaults.WEBSOCKET_URL
}; 