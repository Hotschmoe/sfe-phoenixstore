import { WebSocket } from 'ws';
import { Document, Filter } from 'mongodb';
import { nanoid } from 'nanoid/non-secure';
import { 
  WebSocketMessage,
  WatchDocumentMessage,
  WatchCollectionMessage,
  PresenceMessage,
  UnwatchMessage,
  AuthMessage,
  DocumentChange,
  CollectionChange,
  Subscription,
  WebSocketClientState,
  ChangeType
} from '../types/websocket';
import { MongoAdapter } from '../adapters/MongoAdapter';

export interface WebSocketManagerConfig {
  heartbeatInterval?: number;
  maxClients?: number;
  pingTimeout?: number;
  pollingInterval?: number;  // Interval for polling document/collection changes
}

export class WebSocketManager {
  private clients: Map<WebSocket, WebSocketClientState> = new Map();
  private watchIntervals: Map<string, NodeJS.Timer> = new Map();
  private mongoAdapter: MongoAdapter;
  private config: Required<WebSocketManagerConfig>;

  constructor(
    mongoAdapter: MongoAdapter, 
    config: WebSocketManagerConfig = {}
  ) {
    this.mongoAdapter = mongoAdapter;
    this.config = {
      heartbeatInterval: config.heartbeatInterval ?? 30000,
      maxClients: config.maxClients ?? 10000,
      pingTimeout: config.pingTimeout ?? 5000,
      pollingInterval: config.pollingInterval ?? 1000  // Default to 1 second polling
    };
  }

  // Handle new WebSocket connection
  public handleConnection(ws: WebSocket): void {
    // Check max clients limit
    if (this.clients.size >= this.config.maxClients) {
      this.sendError(ws, 'MAX_CLIENTS_REACHED', 'Maximum number of clients reached');
      ws.close();
      return;
    }

    const clientState: WebSocketClientState = {
      userId: '',  // Will be set after authentication
      subscriptions: new Map(),
      lastSeen: Date.now(),
      status: 'online'
    };

    this.clients.set(ws, clientState);

    // Set up ping/pong for connection health check
    const pingInterval = setInterval(() => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.ping();
        const pongTimeout = setTimeout(() => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.terminate();
          }
        }, this.config.pingTimeout);

        ws.once('pong', () => {
          clearTimeout(pongTimeout);
          if (clientState) {
            clientState.lastSeen = Date.now();
          }
        });
      }
    }, this.config.heartbeatInterval);

    ws.on('message', async (data: string) => {
      try {
        const message: WebSocketMessage = JSON.parse(data);
        await this.handleMessage(ws, message);
      } catch (error) {
        this.sendError(ws, 'INVALID_MESSAGE', 'Invalid message format');
      }
    });

    ws.on('close', () => {
      clearInterval(pingInterval);
      this.handleDisconnection(ws);
    });

    // Send connected message
    this.send(ws, { type: 'connected', requestId: nanoid() });
  }

  // Handle client messages
  private async handleMessage(ws: WebSocket, message: WebSocketMessage): Promise<void> {
    const clientState = this.clients.get(ws);
    if (!clientState) return;

    switch (message.type) {
      case 'auth':
        await this.handleAuth(ws, message as AuthMessage);
        break;
      case 'watch_document':
        await this.handleWatchDocument(ws, message as WatchDocumentMessage);
        break;
      case 'watch_collection':
        await this.handleWatchCollection(ws, message as WatchCollectionMessage);
        break;
      case 'presence':
        await this.handlePresence(ws, message as PresenceMessage);
        break;
      case 'unwatch':
        await this.handleUnwatch(ws, message as UnwatchMessage);
        break;
    }
  }

  // Handle authentication
  private async handleAuth(ws: WebSocket, message: AuthMessage): Promise<void> {
    try {
      // TODO: Implement token verification
      const userId = 'user_' + nanoid(); // Temporary, replace with actual user ID from token
      const clientState = this.clients.get(ws);
      
      if (clientState) {
        clientState.userId = userId;
        // Send auth response with all required fields
        const response = { 
          type: 'auth' as const,
          requestId: message.requestId,
          userId,
          status: 'success'
        };
        this.send(ws, response);
      } else {
        this.sendError(ws, 'AUTH_FAILED', 'Client state not found');
      }
    } catch (error) {
      console.error('Authentication error:', error);
      this.sendError(ws, 'AUTH_FAILED', 'Authentication failed');
    }
  }

  // Handle document watch request using polling
  private async handleWatchDocument(ws: WebSocket, message: WatchDocumentMessage): Promise<void> {
    const clientState = this.clients.get(ws);
    if (!clientState?.userId) {
      this.sendError(ws, 'UNAUTHORIZED', 'Authentication required');
      return;
    }

    const subscriptionId = nanoid();
    const subscription: Subscription = {
      id: subscriptionId,
      userId: clientState.userId,
      type: 'document',
      collection: message.collection,
      documentId: message.documentId,
      createdAt: Date.now(),
      lastUpdated: Date.now()
    };

    clientState.subscriptions.set(subscriptionId, subscription);

    // Send initial document state
    const initialDoc = await this.mongoAdapter.get(message.collection, message.documentId);
    if (initialDoc) {
      this.send(ws, {
        type: 'watch_document',
        requestId: message.requestId,
        subscriptionId,
        change: {
          type: 'added',
          documentId: message.documentId,
          data: initialDoc,
          timestamp: Date.now()
        }
      });
    }

    // Set up polling interval for document changes
    const interval = setInterval(async () => {
      try {
        const currentDoc = await this.mongoAdapter.get(message.collection, message.documentId);
        
        if (!currentDoc) {
          // Document was deleted
          this.send(ws, {
            type: 'watch_document',
            requestId: message.requestId,
            subscriptionId,
            change: {
              type: 'removed',
              documentId: message.documentId,
              timestamp: Date.now()
            }
          });
          this.handleUnwatch(ws, { type: 'unwatch', requestId: nanoid(), subscriptionId });
          return;
        }

        // Send update if document changed
        this.send(ws, {
          type: 'watch_document',
          requestId: message.requestId,
          subscriptionId,
          change: {
            type: 'modified',
            documentId: message.documentId,
            data: currentDoc,
            timestamp: Date.now()
          }
        });
      } catch (error) {
        console.error('Error polling document:', error);
      }
    }, this.config.pollingInterval);

    this.watchIntervals.set(subscriptionId, interval);
  }

  // Handle collection watch request using polling
  private async handleWatchCollection(ws: WebSocket, message: WatchCollectionMessage): Promise<void> {
    const clientState = this.clients.get(ws);
    if (!clientState?.userId) {
      this.sendError(ws, 'UNAUTHORIZED', 'Authentication required');
      return;
    }

    const subscriptionId = nanoid();
    const subscription: Subscription = {
      id: subscriptionId,
      userId: clientState.userId,
      type: 'collection',
      collection: message.collection,
      query: message.query,
      createdAt: Date.now(),
      lastUpdated: Date.now()
    };

    clientState.subscriptions.set(subscriptionId, subscription);

    // Send initial collection state
    const filter = this.buildQueryFilter(message.query);
    const initialDocs = await this.mongoAdapter.find(message.collection, filter);
    
    if (initialDocs.length > 0) {
      this.send(ws, {
        type: 'watch_collection',
        requestId: message.requestId,
        subscriptionId,
        change: {
          type: 'added',
          changes: initialDocs.map(doc => ({
            type: 'added' as ChangeType,
            documentId: doc.id,
            data: doc,
            timestamp: Date.now()
          })),
          timestamp: Date.now()
        }
      });
    }

    // Set up polling interval for collection changes
    const interval = setInterval(async () => {
      try {
        const currentDocs = await this.mongoAdapter.find(message.collection, filter);
        
        // Send updates for changed documents
        this.send(ws, {
          type: 'watch_collection',
          requestId: message.requestId,
          subscriptionId,
          change: {
            type: 'modified',
            changes: currentDocs.map(doc => ({
              type: 'modified' as ChangeType,
              documentId: doc.id,
              data: doc,
              timestamp: Date.now()
            })),
            timestamp: Date.now()
          }
        });
      } catch (error) {
        console.error('Error polling collection:', error);
      }
    }, this.config.pollingInterval);

    this.watchIntervals.set(subscriptionId, interval);
  }

  // Handle presence system messages
  private async handlePresence(ws: WebSocket, message: PresenceMessage): Promise<void> {
    const clientState = this.clients.get(ws);
    if (!clientState?.userId) {
      this.sendError(ws, 'UNAUTHORIZED', 'Authentication required');
      return;
    }

    clientState.status = message.status || 'online';
    clientState.lastSeen = Date.now();
    clientState.metadata = message.metadata;

    // Broadcast presence update to all subscribed clients
    this.broadcastPresence(clientState);
  }

  // Handle unwatch request
  private async handleUnwatch(ws: WebSocket, message: UnwatchMessage): Promise<void> {
    const clientState = this.clients.get(ws);
    if (!clientState?.userId) {
      this.sendError(ws, 'UNAUTHORIZED', 'Authentication required');
      return;
    }

    const subscription = clientState.subscriptions.get(message.subscriptionId);
    if (subscription) {
      // Clear polling interval
      const interval = this.watchIntervals.get(message.subscriptionId);
      if (interval) {
        clearInterval(interval);
        this.watchIntervals.delete(message.subscriptionId);
      }
      clientState.subscriptions.delete(message.subscriptionId);
    }
  }

  // Handle client disconnection
  private handleDisconnection(ws: WebSocket): void {
    const clientState = this.clients.get(ws);
    if (clientState) {
      // Clear all polling intervals
      for (const [subscriptionId] of clientState.subscriptions) {
        const interval = this.watchIntervals.get(subscriptionId);
        if (interval) {
          clearInterval(interval);
          this.watchIntervals.delete(subscriptionId);
        }
      }

      // Update presence
      clientState.status = 'offline';
      clientState.lastSeen = Date.now();
      this.broadcastPresence(clientState);

      this.clients.delete(ws);
    }
  }

  // Utility method to send messages
  private send(ws: WebSocket, message: any): void {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(message));
    }
  }

  // Utility method to send errors
  private sendError(ws: WebSocket, code: string, message: string): void {
    this.send(ws, {
      type: 'error',
      requestId: nanoid(),
      code,
      message
    });
  }

  // Utility method to broadcast presence updates
  private broadcastPresence(clientState: WebSocketClientState): void {
    const presenceUpdate: PresenceMessage = {
      type: 'presence',
      requestId: nanoid(),
      action: 'update',
      userId: clientState.userId,
      status: clientState.status,
      lastSeen: clientState.lastSeen,
      metadata: clientState.metadata
    };

    for (const [ws, state] of this.clients) {
      if (state.userId && state.userId !== clientState.userId) {
        this.send(ws, presenceUpdate);
      }
    }
  }

  // Utility method to build MongoDB query filter
  private buildQueryFilter(query?: WatchCollectionMessage['query']): Filter<Document> {
    const filter: Filter<Document> = {};

    if (query?.where) {
      const $and: any[] = [];
      for (const condition of query.where) {
        const mongoOperator = this.getMongoOperator(condition.operator);
        $and.push({
          [condition.field]: { [mongoOperator]: condition.value }
        });
      }
      if ($and.length > 0) {
        filter.$and = $and;
      }
    }

    return filter;
  }

  // Utility method to convert query operators to MongoDB operators
  private getMongoOperator(operator: string): string {
    switch (operator) {
      case '==': return '$eq';
      case '!=': return '$ne';
      case '<': return '$lt';
      case '<=': return '$lte';
      case '>': return '$gt';
      case '>=': return '$gte';
      case 'in': return '$in';
      case 'not-in': return '$nin';
      case 'array-contains': return '$elemMatch';
      case 'array-contains-any': return '$in';
      default: return '$eq';
    }
  }
} 