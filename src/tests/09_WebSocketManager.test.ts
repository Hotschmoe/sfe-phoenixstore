import { describe, test, expect, beforeAll, afterAll, beforeEach, afterEach } from 'bun:test';
import WebSocket from 'ws';
import { MongoAdapter } from '../adapters/MongoAdapter';
import { WebSocketManager } from '../core/WebSocketManager';
import { config } from '../utils/config';
import { setup, teardown, getTestWebSocketConfig, TEST_CONFIG } from './setup';
import { WebSocketMessage, DocumentChange, CollectionChange } from '../types/websocket';

interface WatchDocumentResponse extends WebSocketMessage {
  type: 'watch_document';
  subscriptionId: string;
  change: DocumentChange;
}

interface WatchCollectionResponse extends WebSocketMessage {
  type: 'watch_collection';
  subscriptionId: string;
  change: CollectionChange;
}

describe('WebSocketManager', () => {
  let mongoAdapter: MongoAdapter;
  let wsManager: WebSocketManager;
  let wsServer: WebSocket.Server;
  let wsClient: WebSocket;
  const wsConfig = getTestWebSocketConfig();
  const WS_URL = `ws://localhost:${TEST_CONFIG.websocket.port}`;

  beforeAll(async () => {
    // Set up test database
    await setup();
    
    // Create MongoDB adapter
    mongoAdapter = new MongoAdapter(
      `mongodb://${config.MONGODB_USER}:${config.MONGODB_PASSWORD}@localhost:${config.MONGODB_PORT}/${config.MONGODB_DATABASE}?authSource=admin`,
      config.MONGODB_DATABASE
    );
    await mongoAdapter.connect();

    // Create WebSocket server with test configuration
    wsServer = new WebSocket.Server({ 
      port: TEST_CONFIG.websocket.port,
      clientTracking: true,
      maxPayload: 50 * 1024 * 1024, // 50MB max payload
      perMessageDeflate: {
        zlibDeflateOptions: {
          chunkSize: 1024,
          memLevel: 7,
          level: 3
        },
        zlibInflateOptions: {
          chunkSize: 10 * 1024
        },
        clientNoContextTakeover: true,
        serverNoContextTakeover: true,
        serverMaxWindowBits: 10,
        concurrencyLimit: 10,
        threshold: 1024
      }
    });

    // Create WebSocket manager with test configuration
    wsManager = new WebSocketManager(mongoAdapter, wsConfig);

    wsServer.on('connection', (ws) => wsManager.handleConnection(ws));
  });

  afterAll(async () => {
    // Clean up
    await teardown();
    await mongoAdapter.disconnect();
    await new Promise((resolve) => wsServer.close(resolve));
  });

  beforeEach(async () => {
    // Create a new WebSocket client for each test
    wsClient = new WebSocket(WS_URL);
    await new Promise((resolve) => wsClient.on('open', resolve));
  });

  afterEach(async () => {
    // Close client connection
    if (wsClient.readyState === WebSocket.OPEN) {
      wsClient.close();
    }
  });

  test('should receive connected message on connection', async () => {
    const message = await new Promise((resolve) => {
      wsClient.once('message', (data) => {
        resolve(JSON.parse(data.toString()));
      });
    });

    expect(message).toHaveProperty('type', 'connected');
    expect(message).toHaveProperty('requestId');
  });

  test('should handle authentication', async () => {
    // Wait for initial connected message
    await new Promise((resolve) => {
      wsClient.once('message', (data) => {
        const msg = JSON.parse(data.toString());
        expect(msg.type).toBe('connected');
        resolve(null);
      });
    });

    const authMessage = {
      type: 'auth',
      requestId: 'test-auth-1',
      token: 'test-token'
    };

    wsClient.send(JSON.stringify(authMessage));

    const response = await new Promise((resolve) => {
      wsClient.once('message', (data) => {
        resolve(JSON.parse(data.toString()));
      });
    });

    expect(response).toHaveProperty('type', 'auth');
    expect(response).toHaveProperty('requestId', 'test-auth-1');
    expect(response).toHaveProperty('userId');
  });

  test('should handle document watching', async () => {
    // First authenticate
    const authMessage = {
      type: 'auth',
      requestId: 'test-auth-2',
      token: 'test-token'
    };
    wsClient.send(JSON.stringify(authMessage));
    await new Promise((resolve) => {
      wsClient.once('message', resolve);
    });

    // Create a test document
    const testDoc = { name: 'Test User', email: 'test@example.com' };
    const docId = await mongoAdapter.add('users', testDoc);

    // Watch the document
    const watchMessage = {
      type: 'watch_document',
      requestId: 'test-watch-1',
      collection: 'users',
      documentId: docId
    };

    wsClient.send(JSON.stringify(watchMessage));

    // Should receive initial document state
    const initialState = await new Promise<WatchDocumentResponse>((resolve) => {
      wsClient.once('message', (data) => {
        resolve(JSON.parse(data.toString()));
      });
    });

    expect(initialState.type).toBe('watch_document');
    expect(initialState.change.type).toBe('added');
    expect(initialState.change.data?.name).toBe('Test User');

    // Update the document
    await mongoAdapter.update('users', docId, { name: 'Updated User' });

    // Should receive update notification
    const updateNotification = await new Promise<WatchDocumentResponse>((resolve) => {
      wsClient.once('message', (data) => {
        resolve(JSON.parse(data.toString()));
      });
    });

    expect(updateNotification.type).toBe('watch_document');
    expect(updateNotification.change.type).toBe('modified');
    expect(updateNotification.change.data?.name).toBe('Updated User');
  });

  test('should handle collection watching with query', async () => {
    // First authenticate
    const authMessage = {
      type: 'auth',
      requestId: 'test-auth-3',
      token: 'test-token'
    };
    wsClient.send(JSON.stringify(authMessage));
    await new Promise((resolve) => {
      wsClient.once('message', resolve);
    });

    // Create test documents
    const testDocs = [
      { name: 'User 1', age: 25 },
      { name: 'User 2', age: 30 },
      { name: 'User 3', age: 35 }
    ];

    for (const doc of testDocs) {
      await mongoAdapter.add('users', doc);
    }

    // Watch the collection with query
    const watchMessage = {
      type: 'watch_collection',
      requestId: 'test-watch-2',
      collection: 'users',
      query: {
        where: [
          { field: 'age', operator: '>', value: 28 }
        ],
        orderBy: [
          { field: 'age', direction: 'asc' }
        ]
      }
    };

    wsClient.send(JSON.stringify(watchMessage));

    // Should receive initial collection state
    const initialState = await new Promise<WatchCollectionResponse>((resolve) => {
      wsClient.once('message', (data) => {
        resolve(JSON.parse(data.toString()));
      });
    });

    expect(initialState).toHaveProperty('type', 'watch_collection');
    expect(initialState).toHaveProperty('change.type', 'added');
    expect(initialState.change.changes).toHaveLength(2); // Users 2 and 3
    expect(initialState.change.changes![0]!.data.name).toBe('User 2');
    expect(initialState.change.changes![1]!.data.name).toBe('User 3');

    // Add a new document that matches the query
    const newDocId = await mongoAdapter.add('users', { name: 'User 4', age: 32 });

    // Should receive update notification
    const updateNotification = await new Promise<WatchCollectionResponse>((resolve) => {
      wsClient.once('message', (data) => {
        resolve(JSON.parse(data.toString()));
      });
    });

    expect(updateNotification).toHaveProperty('type', 'watch_collection');
    expect(updateNotification.change.changes![0]!.data.name).toBe('User 4');
  });

  test('should handle presence system', async () => {
    // Create two clients
    const client1 = new WebSocket(WS_URL);
    const client2 = new WebSocket(WS_URL);
    await Promise.all([
      new Promise((resolve) => client1.on('open', resolve)),
      new Promise((resolve) => client2.on('open', resolve))
    ]);

    // Authenticate both clients
    const auth1 = { type: 'auth', requestId: 'test-auth-4', token: 'token-1' };
    const auth2 = { type: 'auth', requestId: 'test-auth-5', token: 'token-2' };

    client1.send(JSON.stringify(auth1));
    client2.send(JSON.stringify(auth2));

    await Promise.all([
      new Promise((resolve) => client1.once('message', resolve)),
      new Promise((resolve) => client2.once('message', resolve))
    ]);

    // Send presence update from client1
    const presenceMessage = {
      type: 'presence',
      requestId: 'test-presence-1',
      action: 'update',
      status: 'away',
      metadata: { location: 'meeting' }
    };

    client1.send(JSON.stringify(presenceMessage));

    // Client2 should receive presence update
    const presenceUpdate = await new Promise((resolve) => {
      client2.once('message', (data) => {
        resolve(JSON.parse(data.toString()));
      });
    });

    expect(presenceUpdate).toHaveProperty('type', 'presence');
    expect(presenceUpdate).toHaveProperty('status', 'away');
    expect(presenceUpdate).toHaveProperty('metadata.location', 'meeting');

    // Clean up
    client1.close();
    client2.close();
  });

  test('should handle unwatch requests', async () => {
    // First authenticate
    const authMessage = {
      type: 'auth',
      requestId: 'test-auth-6',
      token: 'test-token'
    };
    wsClient.send(JSON.stringify(authMessage));
    await new Promise((resolve) => {
      wsClient.once('message', resolve);
    });

    // Start watching a document
    const docId = await mongoAdapter.add('users', { name: 'Test User' });
    const watchMessage = {
      type: 'watch_document',
      requestId: 'test-watch-3',
      collection: 'users',
      documentId: docId
    };

    wsClient.send(JSON.stringify(watchMessage));
    const watchResponse = await new Promise<WatchDocumentResponse>((resolve) => {
      wsClient.once('message', (data) => {
        resolve(JSON.parse(data.toString()));
      });
    });

    // Send unwatch request
    const unwatchMessage = {
      type: 'unwatch',
      requestId: 'test-unwatch-1',
      subscriptionId: watchResponse.subscriptionId
    };

    wsClient.send(JSON.stringify(unwatchMessage));

    // Update document - should not receive update
    await mongoAdapter.update('users', docId, { name: 'Updated User' });

    // Wait a bit to ensure no message is received
    const received = await new Promise((resolve) => {
      const timeout = setTimeout(() => resolve(false), 1000);
      wsClient.once('message', () => {
        clearTimeout(timeout);
        resolve(true);
      });
    });

    expect(received).toBe(false);
  });
}); 