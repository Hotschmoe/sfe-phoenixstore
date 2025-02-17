// Types for WebSocket messages and events
export type WebSocketMessageType = 
  | 'watch_document'      // Watch a single document
  | 'watch_collection'    // Watch a collection with query
  | 'presence'           // Presence system events
  | 'unwatch'            // Stop watching
  | 'error'              // Error events
  | 'auth'               // Authentication events
  | 'connected'          // Connection established
  | 'disconnected';      // Connection lost

// Base message interface
export interface WebSocketMessage {
  type: WebSocketMessageType;
  requestId: string;      // Unique ID for request-response matching
}

// Document watch message
export interface WatchDocumentMessage extends WebSocketMessage {
  type: 'watch_document';
  collection: string;
  documentId: string;
}

// Collection watch message with query support
export interface WatchCollectionMessage extends WebSocketMessage {
  type: 'watch_collection';
  collection: string;
  query?: {
    where?: Array<{
      field: string;
      operator: string;
      value: any;
    }>;
    orderBy?: Array<{
      field: string;
      direction: 'asc' | 'desc';
    }>;
    limit?: number;
    offset?: number;
  };
}

// Presence system message
export interface PresenceMessage extends WebSocketMessage {
  type: 'presence';
  action: 'join' | 'leave' | 'update';
  userId: string;
  status?: 'online' | 'offline' | 'away';
  lastSeen?: number;
  metadata?: Record<string, any>;
}

// Unwatch message
export interface UnwatchMessage extends WebSocketMessage {
  type: 'unwatch';
  subscriptionId: string;
}

// Error message
export interface ErrorMessage extends WebSocketMessage {
  type: 'error';
  code: string;
  message: string;
}

// Authentication message
export interface AuthMessage extends WebSocketMessage {
  type: 'auth';
  token: string;
}

// Authentication response message
export interface AuthResponseMessage extends WebSocketMessage {
  type: 'auth';
  requestId: string;
  userId: string;
  status: 'success' | 'error';
}

// Change event types
export type ChangeType = 'added' | 'modified' | 'removed';

// Document change event
export interface DocumentChange {
  type: ChangeType;
  documentId: string;
  data?: Record<string, any>;
  oldData?: Record<string, any>;
  timestamp: number;
}

// Collection change event
export interface CollectionChange {
  type: ChangeType;
  changes: DocumentChange[];
  timestamp: number;
}

// Subscription interface
export interface Subscription {
  id: string;
  userId: string;
  type: 'document' | 'collection' | 'presence';
  collection?: string;
  documentId?: string;
  query?: WatchCollectionMessage['query'];
  createdAt: number;
  lastUpdated: number;
}

// WebSocket client state
export interface WebSocketClientState {
  userId: string;
  subscriptions: Map<string, Subscription>;
  lastSeen: number;
  status: 'online' | 'offline' | 'away';
  metadata?: Record<string, any>;
} 