import { PhoenixStore } from '../core/PhoenixStore';
import { PhoenixStoreError } from '../types';
import { verifyToken } from '../utils/jwt';

export class WebSocketManager {
    private store: PhoenixStore;
    private connections: Map<string, WebSocket> = new Map();

    constructor(store: PhoenixStore) {
        this.store = store;
    }

    async handleConnection(ws: WebSocket): Promise<void> {
        // Generate a unique connection ID
        const connectionId = Math.random().toString(36).substring(2, 15);
        this.connections.set(connectionId, ws);

        // Set up message handler
        ws.onmessage = async (event) => {
            try {
                const message = JSON.parse(event.data.toString());
                await this.handleMessage(connectionId, ws, message);
            } catch (error) {
                this.sendError(ws, 'Invalid message format');
            }
        };

        // Set up close handler
        ws.onclose = () => {
            this.connections.delete(connectionId);
        };
    }

    private async handleMessage(connectionId: string, ws: WebSocket, message: any): Promise<void> {
        if (!message.type || !message.requestId) {
            this.sendError(ws, 'Invalid message format', message.requestId);
            return;
        }

        try {
            switch (message.type) {
                case 'auth':
                    await this.handleAuth(ws, message);
                    break;
                case 'watch_collection':
                    await this.handleWatchCollection(ws, message);
                    break;
                case 'unwatch':
                    await this.handleUnwatch(ws, message);
                    break;
                default:
                    this.sendError(ws, `Unknown message type: ${message.type}`, message.requestId);
            }
        } catch (error) {
            this.sendError(ws, error instanceof Error ? error.message : 'Internal server error', message.requestId);
        }
    }

    private async handleAuth(ws: WebSocket, message: any): Promise<void> {
        if (!message.token) {
            this.sendError(ws, 'No token provided', message.requestId);
            return;
        }

        try {
            // Verify the token
            const payload = await verifyToken(message.token, 'access');
            
            // Send success response
            ws.send(JSON.stringify({
                type: 'auth',
                requestId: message.requestId,
                status: 'success',
                data: {
                    userId: payload.sub
                }
            }));
        } catch (error) {
            this.sendError(ws, 'Invalid token', message.requestId);
        }
    }

    private async handleWatchCollection(ws: WebSocket, message: any): Promise<void> {
        if (!message.collection) {
            this.sendError(ws, 'No collection specified', message.requestId);
            return;
        }

        try {
            // Query the collection
            const documents = await this.store.getAdapter().query(message.collection, message.query?.conditions || []);
            
            // Send initial data
            ws.send(JSON.stringify({
                type: 'watch_collection',
                requestId: message.requestId,
                status: 'success',
                data: {
                    documents,
                    subscriptionId: `watch-${message.collection}`
                }
            }));
        } catch (error) {
            this.sendError(ws, 'Failed to watch collection', message.requestId);
        }
    }

    private async handleUnwatch(ws: WebSocket, message: any): Promise<void> {
        if (!message.subscriptionId) {
            this.sendError(ws, 'No subscription ID provided', message.requestId);
            return;
        }

        // Send success response
        ws.send(JSON.stringify({
            type: 'unwatch',
            requestId: message.requestId,
            status: 'success'
        }));
    }

    private sendError(ws: WebSocket, message: string, requestId?: string): void {
        ws.send(JSON.stringify({
            type: 'error',
            ...(requestId && { requestId }),
            status: 'error',
            message
        }));
    }
} 