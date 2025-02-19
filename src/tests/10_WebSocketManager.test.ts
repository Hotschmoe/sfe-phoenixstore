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

  // Helper function to wait for specific message type
  const waitForMessage = async <T extends WebSocketMessage>(
    queue: T[],
    expectedType: T['type'],
    timeout: number = 5000
  ): Promise<T> => {
    const startTime = Date.now();
    while (queue.length === 0 || queue[0].type !== expectedType) {
      if (Date.now() - startTime > timeout) {
        throw new Error(`Timeout waiting for ${expectedType} message`);
      }
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    const message = queue.shift();
    if (!message || message.type !== expectedType) {
      throw new Error(`Expected ${expectedType} message`);
    }
    return message;
  };

  // Helper function to authenticate client
  const authenticateClient = async (
    client: WebSocket,
    messageQueue: (ConnectedMessage | AuthResponseMessage)[],
    requestId: string = 'test-auth'
  ): Promise<AuthResponseMessage> => {
    const messageHandler = (data: WebSocket.RawData) => {
      const msg = JSON.parse(data.toString());
      if (msg && typeof msg === 'object' && 'type' in msg) {
        messageQueue.push(msg as ConnectedMessage | AuthResponseMessage);
      }
    };
    client.on('message', messageHandler);

    // Wait for connected message
    const connectedMsg = await waitForMessage<ConnectedMessage>(
      messageQueue as ConnectedMessage[],
      'connected'
    );
    expect(connectedMsg.requestId).toBeTruthy();

    // Send auth message
    const authMessage = {
      type: 'auth',
      requestId,
      token: 'test-token'
    };
    client.send(JSON.stringify(authMessage));

    // Wait for auth response
    const authResponse = await waitForMessage<AuthResponseMessage>(
      messageQueue as AuthResponseMessage[],
      'auth'
    );
    expect(authResponse.requestId).toBe(requestId);
    expect(authResponse.status).toBe('success');
    expect(typeof authResponse.userId).toBe('string');

    client.off('message', messageHandler);
    return authResponse;
  };

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
    await authenticateClient(wsClient, messageQueue, 'test-auth-1');
  }, 15000);

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
  }, 15000);

  test('should handle collection watching with query', async () => {
    // Create separate queues for different message types for type safety
    const authQueue: (ConnectedMessage | AuthResponseMessage)[] = [];
    const watchQueue: WatchCollectionResponse[] = [];
    
    // Set up message handler after authentication
    const setupMessageHandler = () => {
      const handler = (data: WebSocket.RawData) => {
        const msg = JSON.parse(data.toString());
        if (!msg || typeof msg !== 'object' || !('type' in msg)) return;
        
        // Route messages to appropriate queues
        switch (msg.type) {
          case 'watch_collection':
            watchQueue.push(msg as WatchCollectionResponse);
            break;
        }
      };
      wsClient.on('message', handler);
      return handler;
    };

    // Authenticate first without the watch message handler
    await authenticateClient(wsClient, authQueue, 'test-auth-3');

    // Now set up the watch message handler
    const messageHandler = setupMessageHandler();

    // Clean up any existing documents
    const collection = mongoAdapter.getCollection('users');
    await collection.deleteMany({});

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

    // Wait for initial collection state
    const initialState = await waitForMessage(watchQueue, 'watch_collection');
    expect(initialState.type).toBe('watch_collection');
    expect(initialState.change.type).toBe('added');
    
    // Verify we only get documents matching our query
    const matchingDocs = initialState.change.changes?.filter(change => 
      change.data && change.data.age > 28
    );
    expect(matchingDocs).toHaveLength(2);
    
    if (matchingDocs && matchingDocs.length === 2) {
      expect(matchingDocs[0].data?.name).toBe('User 2');
      expect(matchingDocs[0].data?.age).toBe(30);
      expect(matchingDocs[1].data?.name).toBe('User 3');
      expect(matchingDocs[1].data?.age).toBe(35);
    }

    // Add a new document that matches the query
    watchQueue.length = 0;
    const newDocId = await mongoAdapter.add('users', { name: 'User 4', age: 32 });

    // Wait for update notification
    const updateNotification = await waitForMessage(watchQueue, 'watch_collection');
    expect(updateNotification.type).toBe('watch_collection');
    
    // Verify all documents are present and in correct order
    const updatedDocs = updateNotification.change.changes?.filter(change => 
      change.data && change.data.age > 28
    ).sort((a, b) => ((a.data?.age || 0) - (b.data?.age || 0)));
    expect(updatedDocs).toHaveLength(3);
    
    if (updatedDocs && updatedDocs.length === 3) {
      expect(updatedDocs[0].data?.name).toBe('User 2');
      expect(updatedDocs[0].data?.age).toBe(30);
      expect(updatedDocs[1].data?.name).toBe('User 4');
      expect(updatedDocs[1].data?.age).toBe(32);
      expect(updatedDocs[2].data?.name).toBe('User 3');
      expect(updatedDocs[2].data?.age).toBe(35);
    }

    await collection.deleteMany({});

    // Clean up
    wsClient.off('message', messageHandler);
  }, 15000);

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
  }, 15000);

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
  }, 15000);
}); 