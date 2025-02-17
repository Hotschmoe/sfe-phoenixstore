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

interface ConnectedMessage extends WebSocketMessage {
  type: 'connected';
  requestId: string;
}

interface AuthResponseMessage extends WebSocketMessage {
  type: 'auth';
  requestId: string;
  userId: string;
  status: string;
}

interface PresenceMessage extends WebSocketMessage {
  type: 'presence';
  requestId: string;
  action: string;
  status: string;
  metadata?: { location: string };
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
    
    // Force close all WebSocket connections
    const closePromises: Promise<void>[] = [];
    wsServer.clients.forEach(client => {
      closePromises.push(new Promise((resolve) => {
        client.on('close', resolve);
        client.terminate();
      }));
    });
    await Promise.all(closePromises);
    
    // Close the server
    await new Promise<void>((resolve) => wsServer.close(() => resolve()));
  });

  beforeEach(async () => {
    // Create a new WebSocket client for each test
    wsClient = new WebSocket(WS_URL);
    await new Promise((resolve) => wsClient.on('open', resolve));
  });

  afterEach(async () => {
    // Close client connection
    if (wsClient.readyState === WebSocket.OPEN) {
      await new Promise<void>((resolve) => {
        wsClient.on('close', resolve);
        wsClient.close();
      });
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
    const messageQueue: (ConnectedMessage | AuthResponseMessage)[] = [];
    const messageHandler = (data: WebSocket.RawData) => {
      const msg = JSON.parse(data.toString());
      if (msg && typeof msg === 'object' && 'type' in msg) {
        messageQueue.push(msg as ConnectedMessage | AuthResponseMessage);
      }
    };
    wsClient.on('message', messageHandler);

    // Wait for connected message
    while (messageQueue.length === 0 || messageQueue[0].type !== 'connected') {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    const connectedMsg = messageQueue.shift() as ConnectedMessage;
    expect(connectedMsg.type).toBe('connected');
    expect(connectedMsg.requestId).toBeTruthy();

    // Send auth message
    const authMessage = {
      type: 'auth',
      requestId: 'test-auth-1',
      token: 'test-token'
    };
    wsClient.send(JSON.stringify(authMessage));

    // Wait for auth response
    const startTime = Date.now();
    while (messageQueue.length === 0 || messageQueue[0].type !== 'auth') {
      if (Date.now() - startTime > 5000) {
        throw new Error('Timeout waiting for auth response');
      }
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    const authResponse = messageQueue.shift() as AuthResponseMessage;

    expect(authResponse.type).toBe('auth');
    expect(authResponse.requestId).toBe('test-auth-1');
    expect(authResponse.status).toBe('success');
    expect(typeof authResponse.userId).toBe('string');

    // Clean up
    wsClient.off('message', messageHandler);
  }, 15000); // Increase overall test timeout to 15 seconds

  test('should handle document watching', async () => {
    const messageQueue: (ConnectedMessage | AuthResponseMessage | WatchDocumentResponse)[] = [];
    const messageHandler = (data: WebSocket.RawData) => {
      const msg = JSON.parse(data.toString());
      if (msg && typeof msg === 'object' && 'type' in msg) {
        messageQueue.push(msg as ConnectedMessage | AuthResponseMessage | WatchDocumentResponse);
      }
    };
    wsClient.on('message', messageHandler);

    // First authenticate
    const authMessage = {
      type: 'auth',
      requestId: 'test-auth-2',
      token: 'test-token'
    };
    wsClient.send(JSON.stringify(authMessage));
    
    // Wait for connected and auth messages
    const authStartTime = Date.now();
    while (messageQueue.length < 2) {
      if (Date.now() - authStartTime > 5000) {
        throw new Error('Timeout waiting for auth response');
      }
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    const [msg1, msg2] = messageQueue.splice(0, 2);
    if (!msg1 || !msg2 || 
        msg1.type !== 'connected' || 
        msg2.type !== 'auth') {
      throw new Error('Unexpected message types');
    }
    const connectedMsg = msg1 as ConnectedMessage;
    const authResponse = msg2 as AuthResponseMessage;

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

    // Wait for initial document state
    const startTime = Date.now();
    while (messageQueue.length === 0) {
      if (Date.now() - startTime > 5000) {
        throw new Error('Timeout waiting for initial document state');
      }
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    const initialState = messageQueue.shift();
    if (!initialState || initialState.type !== 'watch_document') {
      throw new Error('Expected watch_document message');
    }

    expect(initialState.type).toBe('watch_document');
    expect(initialState.change.type).toBe('added');
    expect(initialState.change.data?.name).toBe('Test User');

    // Update the document
    await mongoAdapter.update('users', docId, { name: 'Updated User' });

    // Wait for update notification (polling interval is 500ms for tests)
    messageQueue.length = 0; // Clear any pending messages
    const updateStartTime = Date.now();
    while (messageQueue.length === 0) {
      if (Date.now() - updateStartTime > 2000) {
        throw new Error('Timeout waiting for document update');
      }
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    const updateNotification = messageQueue.shift();
    if (!updateNotification || updateNotification.type !== 'watch_document') {
      throw new Error('Expected watch_document message');
    }

    expect(updateNotification.type).toBe('watch_document');
    expect(updateNotification.change.type).toBe('modified');
    expect(updateNotification.change.data?.name).toBe('Updated User');

    // Clean up
    wsClient.off('message', messageHandler);
  }, 15000); // Increase timeout to 15 seconds

  test('should handle collection watching with query', async () => {
    const messageQueue: (ConnectedMessage | AuthResponseMessage | WatchCollectionResponse)[] = [];
    const messageHandler = (data: WebSocket.RawData) => {
      const msg = JSON.parse(data.toString());
      if (msg && typeof msg === 'object' && 'type' in msg) {
        messageQueue.push(msg as ConnectedMessage | AuthResponseMessage | WatchCollectionResponse);
      }
    };
    wsClient.on('message', messageHandler);

    // First authenticate
    const authMessage = {
      type: 'auth',
      requestId: 'test-auth-3',
      token: 'test-token'
    };
    wsClient.send(JSON.stringify(authMessage));
    
    // Wait for connected and auth messages
    const authStartTime = Date.now();
    while (messageQueue.length < 2) {
      if (Date.now() - authStartTime > 5000) {
        throw new Error('Timeout waiting for auth response');
      }
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    const [msg1, msg2] = messageQueue.splice(0, 2);
    if (!msg1 || !msg2 || 
        msg1.type !== 'connected' || 
        msg2.type !== 'auth') {
      throw new Error('Unexpected message types');
    }
    const connectedMsg = msg1 as ConnectedMessage;
    const authResponse = msg2 as AuthResponseMessage;

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

    messageQueue.length = 0; // Clear any pending messages
    wsClient.send(JSON.stringify(watchMessage));

    // Wait for initial collection state
    const startTime = Date.now();
    while (messageQueue.length === 0) {
      if (Date.now() - startTime > 5000) {
        throw new Error('Timeout waiting for initial collection state');
      }
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    const initialState = messageQueue.shift() as WatchCollectionResponse;
    if (!initialState || initialState.type !== 'watch_collection') {
      throw new Error('Expected watch_collection message');
    }

    expect(initialState.type).toBe('watch_collection');
    expect(initialState.change.type).toBe('added');
    expect(initialState.change.changes).toHaveLength(2); // Users 2 and 3
    expect(initialState.change.changes?.[0]?.data?.name).toBe('User 2');
    expect(initialState.change.changes?.[1]?.data?.name).toBe('User 3');

    // Add a new document that matches the query
    messageQueue.length = 0; // Clear any pending messages
    const newDocId = await mongoAdapter.add('users', { name: 'User 4', age: 32 });

    // Wait for update notification
    const updateStartTime = Date.now();
    while (messageQueue.length === 0) {
      if (Date.now() - updateStartTime > 5000) {
        throw new Error('Timeout waiting for collection update');
      }
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    const updateNotification = messageQueue.shift() as WatchCollectionResponse;
    if (!updateNotification || updateNotification.type !== 'watch_collection') {
      throw new Error('Expected watch_collection message');
    }

    expect(updateNotification.type).toBe('watch_collection');
    expect(updateNotification.change.changes?.[0]?.data?.name).toBe('User 4');

    // Clean up
    wsClient.off('message', messageHandler);
  }, 15000); // Increase timeout to 15 seconds

  test('should handle presence system', async () => {
    const messageQueue: (ConnectedMessage | AuthResponseMessage | PresenceMessage)[] = [];
    const messageHandler = (data: WebSocket.RawData) => {
      const msg = JSON.parse(data.toString());
      if (msg && typeof msg === 'object' && 'type' in msg) {
        messageQueue.push(msg as ConnectedMessage | AuthResponseMessage | PresenceMessage);
      }
    };

    // Create two clients
    const client1 = new WebSocket(WS_URL);
    const client2 = new WebSocket(WS_URL);

    // Set up message handlers for both clients
    client1.on('message', messageHandler);
    client2.on('message', messageHandler);

    // Wait for connections
    await Promise.all([
      new Promise((resolve) => client1.on('open', resolve)),
      new Promise((resolve) => client2.on('open', resolve))
    ]);

    // Authenticate both clients
    const auth1 = { type: 'auth', requestId: 'test-auth-4', token: 'token-1' };
    const auth2 = { type: 'auth', requestId: 'test-auth-5', token: 'token-2' };

    client1.send(JSON.stringify(auth1));
    client2.send(JSON.stringify(auth2));

    // Wait for all auth responses
    const startTime = Date.now();
    while (messageQueue.length < 4) { // 2 connected + 2 auth messages
      if (Date.now() - startTime > 5000) {
        throw new Error('Timeout waiting for authentication');
      }
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    // Clear message queue after authentication
    messageQueue.length = 0;

    // Send presence update from client1
    const presenceMessage = {
      type: 'presence',
      requestId: 'test-presence-1',
      action: 'update',
      status: 'away',
      metadata: { location: 'meeting' }
    };

    client1.send(JSON.stringify(presenceMessage));

    // Wait for presence update
    const presenceStartTime = Date.now();
    while (messageQueue.length === 0) {
      if (Date.now() - presenceStartTime > 5000) {
        throw new Error('Timeout waiting for presence update');
      }
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    const presenceUpdate = messageQueue.shift();
    if (!presenceUpdate || presenceUpdate.type !== 'presence') {
      throw new Error('Expected presence message');
    }

    expect(presenceUpdate.type).toBe('presence');
    expect(presenceUpdate.status).toBe('away');
    expect(presenceUpdate.metadata?.location).toBe('meeting');

    // Clean up
    client1.off('message', messageHandler);
    client2.off('message', messageHandler);
    await Promise.all([
      new Promise<void>((resolve) => {
        client1.on('close', resolve);
        client1.close();
      }),
      new Promise<void>((resolve) => {
        client2.on('close', resolve);
        client2.close();
      })
    ]);
  }, 15000); // Increase timeout to 15 seconds

  test('should handle unwatch requests', async () => {
    const messageQueue: (ConnectedMessage | AuthResponseMessage | WatchDocumentResponse)[] = [];
    const messageHandler = (data: WebSocket.RawData) => {
      const msg = JSON.parse(data.toString());
      if (msg && typeof msg === 'object' && 'type' in msg) {
        messageQueue.push(msg as ConnectedMessage | AuthResponseMessage | WatchDocumentResponse);
      }
    };
    wsClient.on('message', messageHandler);

    // First authenticate
    const authMessage = {
      type: 'auth',
      requestId: 'test-auth-6',
      token: 'test-token'
    };
    wsClient.send(JSON.stringify(authMessage));
    
    // Wait for connected and auth messages
    const authStartTime = Date.now();
    while (messageQueue.length < 2) {
      if (Date.now() - authStartTime > 5000) {
        throw new Error('Timeout waiting for auth response');
      }
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    const [msg1, msg2] = messageQueue.splice(0, 2);
    if (!msg1 || !msg2 || 
        msg1.type !== 'connected' || 
        msg2.type !== 'auth') {
      throw new Error('Unexpected message types');
    }
    const connectedMsg = msg1 as ConnectedMessage;
    const authResponse = msg2 as AuthResponseMessage;

    // Start watching a document
    const docId = await mongoAdapter.add('users', { name: 'Test User' });
    const watchMessage = {
      type: 'watch_document',
      requestId: 'test-watch-3',
      collection: 'users',
      documentId: docId
    };

    wsClient.send(JSON.stringify(watchMessage));

    // Wait for initial watch response
    const startTime = Date.now();
    while (messageQueue.length === 0) {
      if (Date.now() - startTime > 5000) {
        throw new Error('Timeout waiting for watch response');
      }
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    const watchResponse = messageQueue.shift();
    if (!watchResponse || watchResponse.type !== 'watch_document') {
      throw new Error('Expected watch_document message');
    }

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
    messageQueue.length = 0; // Clear any pending messages
    await new Promise(resolve => setTimeout(resolve, 1000));
    expect(messageQueue.length).toBe(0); // Should not receive any updates

    // Clean up
    wsClient.off('message', messageHandler);
  }, 15000); // Increase timeout to 15 seconds
}); 