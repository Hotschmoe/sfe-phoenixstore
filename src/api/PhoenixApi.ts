import { Elysia } from 'elysia';
import { cors } from '@elysiajs/cors';
import { WebSocket as WS, WebSocketServer } from 'ws';
import { PhoenixStore, CollectionQuery } from '../core/PhoenixStore';
import { DocumentData, PhoenixStoreError, QueryOperator } from '../types';
import { homeHtml } from './home';
import { swaggerPlugin } from './PhoenixSwagger';
import { AuthManager } from '../core/AuthManager';
import { MongoAdapter } from '../adapters/MongoAdapter';
import { StorageAdapter } from '../adapters/StorageAdapter';
import { config } from '../utils/config';

/**
 * PhoenixApi provides a REST API interface for PhoenixStore
 * This will be the main integration point for SDKs (Flutter, etc.)
 * 
 * SDK Implementation Notes:
 * - Each endpoint maps to a Firestore-like operation
 * - Response format is consistent for easy SDK parsing
 * - Error handling follows a standard pattern
 * - Authentication will be JWT-based (to be implemented)
 */
export class PhoenixApi {
  private app: Elysia;
  private store: PhoenixStore;
  private authManager: AuthManager;
  private storageAdapter: StorageAdapter;
  private wsServer: WebSocketServer | null = null;

  constructor(store: PhoenixStore) {
    this.store = store;
    this.app = new Elysia()
      .use(cors())
      .use(swaggerPlugin);

    // Initialize AuthManager with the same database adapter
    this.authManager = new AuthManager(store.getAdapter() as MongoAdapter);
    
    // Initialize StorageAdapter
    this.storageAdapter = new StorageAdapter();
    // this.storageAdapter = new StorageAdapter({
    //   endPoint: config.STORAGE_ENDPOINT,
    //   port: config.STORAGE_PORT,
    //   publicUrl: config.STORAGE_PUBLIC_URL
    // });

    this.setupRoutes();
  }

  private parseQueryParams(query: any) {
    console.log('Debug - Raw query params:', JSON.stringify(query, null, 2));
    const conditions = [];
    const options: { orderBy?: string; orderDirection?: 'asc' | 'desc'; limit?: number; offset?: number } = {};

    // Parse filter conditions
    if (query.filter) {
      try {
        const filter = JSON.parse(decodeURIComponent(query.filter));
        console.log('Debug - Parsed filter:', JSON.stringify(filter, null, 2));
        
        if (Array.isArray(filter)) {
          for (const condition of filter) {
            if (!condition.field || !condition.operator || condition.value === undefined) {
              throw new PhoenixStoreError(
                'Invalid filter format. Each condition must have field, operator, and value',
                'INVALID_QUERY_PARAMS'
              );
            }
            
            // Validate operator
            const validOperators = [
              '==', '!=', '<', '<=', '>', '>=', 
              'in', 'not-in', 
              'array-contains', 'array-contains-any'
            ];
            
            if (!validOperators.includes(condition.operator)) {
              throw new PhoenixStoreError(
                `Invalid operator: ${condition.operator}. Valid operators are: ${validOperators.join(', ')}`,
                'INVALID_QUERY_PARAMS'
              );
            }

            conditions.push({
              field: condition.field,
              operator: condition.operator as QueryOperator,
              value: condition.value
            });
          }
        } else {
          throw new PhoenixStoreError(
            'Filter must be an array of conditions',
            'INVALID_QUERY_PARAMS'
          );
        }
      } catch (error) {
        if (error instanceof PhoenixStoreError) throw error;
        throw new PhoenixStoreError(
          'Invalid filter format. Expected JSON array of conditions',
          'INVALID_QUERY_PARAMS'
        );
      }
    }

    // Parse orderBy (support multiple orderBy fields)
    if (query.orderBy) {
      const orderByFields = Array.isArray(query.orderBy) ? query.orderBy : [query.orderBy];
      const firstOrderBy = orderByFields[0].split(':');
      options.orderBy = firstOrderBy[0];
      options.orderDirection = (firstOrderBy[1]?.toLowerCase() || 'asc') as 'asc' | 'desc';
    }

    // Parse pagination
    if (query.limit) {
      const limit = parseInt(query.limit);
      if (isNaN(limit) || limit < 1 || limit > 1000) {
        throw new PhoenixStoreError(
          'Invalid limit parameter. Must be between 1 and 1000',
          'INVALID_QUERY_PARAMS'
        );
      }
      options.limit = limit;
    }

    if (query.offset) {
      const offset = parseInt(query.offset);
      if (isNaN(offset) || offset < 0) {
        throw new PhoenixStoreError(
          'Invalid offset parameter. Must be non-negative',
          'INVALID_QUERY_PARAMS'
        );
      }
      options.offset = offset;
    }

    return { conditions, options };
  }

  private setupRoutes() {
    // Authentication endpoints
    this.app.post('/api/v1/auth/register', async ({ body }) => {
      try {
        const user = await this.authManager.createUser(body as any);
        return {
          status: 'success',
          data: {
            id: user.id,
            email: user.email,
            displayName: user.displayName
          }
        };
      } catch (error) {
        return this.handleError(error);
      }
    });

    this.app.post('/api/v1/auth/login', async ({ body }) => {
      try {
        const tokens = await this.authManager.signIn(body as any);
        return {
          status: 'success',
          data: tokens
        };
      } catch (error) {
        return this.handleError(error);
      }
    });

    this.app.post('/api/v1/auth/refresh', async ({ body }) => {
      try {
        const tokens = await this.authManager.refreshToken(body as any);
        return {
          status: 'success',
          data: tokens
        };
      } catch (error) {
        return this.handleError(error);
      }
    });

    // Root endpoint with API information
    this.app.get('/', () => {
      return new Response(homeHtml, {
        headers: {
          'Content-Type': 'text/html'
        }
      });
    });

    // Query collection
    this.app.get('/api/v1/:collection', async ({ params, query }) => {
      try {
        console.log('\nDebug - Query endpoint called');
        console.log('Debug - Collection:', params.collection);
        
        const collection = this.store.collection<DocumentData>(params.collection);
        const { conditions, options } = this.parseQueryParams(query);
        
        let results: DocumentData[];
        
        // If no conditions or options, do a simple collection query
        if (conditions.length === 0 && !options.orderBy && !options.limit) {
          results = await collection.query([]);
        } else {
          // Build query using Firestore-like chaining
          let queryBuilder: CollectionQuery<DocumentData>;
          
          console.log('Debug - Building query with conditions:', JSON.stringify(conditions, null, 2));
          
          // Start with first condition or orderBy
          if (conditions.length > 0) {
            queryBuilder = collection.where(
              conditions[0].field,
              conditions[0].operator,
              conditions[0].value
            );
            console.log('Debug - Initial where condition:', JSON.stringify(conditions[0], null, 2));
            
            // Add remaining conditions
            for (let i = 1; i < conditions.length; i++) {
              const condition = conditions[i];
              console.log('Debug - Adding where condition:', JSON.stringify(condition, null, 2));
              queryBuilder = queryBuilder.where(condition.field, condition.operator, condition.value);
            }
          } else if (options.orderBy) {
            queryBuilder = collection.orderBy(options.orderBy, options.orderDirection || 'asc');
          } else {
            queryBuilder = collection.orderBy('id', 'asc');
          }
          
          // Apply orderBy if specified and not already applied
          if (options.orderBy && conditions.length > 0) {
            queryBuilder = queryBuilder.orderBy(options.orderBy, options.orderDirection || 'asc');
          }
          
          // Apply limit if specified
          if (options.limit) {
            queryBuilder = queryBuilder.limit(options.limit);
          }
          
          // Execute query
          console.log('Debug - Executing query...');
          results = await queryBuilder.get();
          console.log('Debug - Query results count:', results.length);
        }

        // Format response to match Firestore structure
        const formattedResults = results.map((doc: DocumentData & { id?: string }) => ({
          id: doc.id || null,
          data: doc
        }));

        return {
          status: 'success',
          data: formattedResults
        };
      } catch (error) {
        console.error('Debug - Query error:', error);
        return this.handleError(error);
      }
    });

    // Create document
    this.app.post('/api/v1/:collection', async ({ params, body }) => {
      try {
        const collection = this.store.collection(params.collection);
        const id = await collection.add(body as DocumentData);
        return { 
          status: 'success',
          data: { 
            id,
            path: `${params.collection}/${id}`
          }
        };
      } catch (error) {
        return this.handleError(error);
      }
    });

    // Read document
    this.app.get('/api/v1/:collection/:id', async ({ params }) => {
      try {
        const collection = this.store.collection(params.collection);
        const doc = await collection.doc(params.id).get();
        const data = doc.data();
        
        if (!data) {
          return {
            status: 'error',
            code: 'DOCUMENT_NOT_FOUND',
            message: 'Document not found'
          };
        }

        return {
          status: 'success',
          data: {
            id: params.id,
            path: `${params.collection}/${params.id}`,
            data
          }
        };
      } catch (error) {
        return this.handleError(error);
      }
    });

    // Update document
    this.app.put('/api/v1/:collection/:id', async ({ params, body }) => {
      try {
        const collection = this.store.collection(params.collection);
        // Check if document exists first
        const doc = await collection.doc(params.id).get();
        if (!doc.data()) {
          return {
            status: 'error',
            code: 'DOCUMENT_NOT_FOUND',
            message: 'Document not found'
          };
        }
        
        await collection.doc(params.id).update(body as DocumentData);
        return { 
          status: 'success',
          data: {
            id: params.id,
            path: `${params.collection}/${params.id}`
          }
        };
      } catch (error) {
        return this.handleError(error);
      }
    });

    // Delete document
    this.app.delete('/api/v1/:collection/:id', async ({ params }) => {
      try {
        const collection = this.store.collection(params.collection);
        // Check if document exists first
        const doc = await collection.doc(params.id).get();
        if (!doc.data()) {
          return {
            status: 'error',
            code: 'DOCUMENT_NOT_FOUND',
            message: 'Document not found'
          };
        }

        await collection.doc(params.id).delete();
        return { 
          status: 'success',
          data: {
            id: params.id,
            path: `${params.collection}/${params.id}`
          }
        };
      } catch (error) {
        return this.handleError(error);
      }
    });

    // Storage endpoints
    this.app.post('/api/v1/storage/upload/:path', async ({ params, body, headers }) => {
      try {
        const contentType = headers['content-type'] || 'application/octet-stream';
        const file = body as Buffer;
        const options = {
          contentType,
          metadata: {
            uploadedBy: 'api',
            timestamp: new Date().toISOString()
          }
        };

        const result = await this.storageAdapter.uploadFile(file, params.path, options);
        return {
          status: 'success',
          data: result
        };
      } catch (error) {
        return this.handleError(error);
      }
    });

    this.app.get('/api/v1/storage/info/:path', async ({ params }) => {
      try {
        const result = await this.storageAdapter.getFileInfo(this.storageAdapter.defaultBucket, params.path);
        return {
          status: 'success',
          data: result
        };
      } catch (error) {
        return this.handleError(error);
      }
    });

    this.app.delete('/api/v1/storage/:path', async ({ params }) => {
      try {
        await this.storageAdapter.deleteFile(this.storageAdapter.defaultBucket, params.path);
        return { status: 'success' };
      } catch (error) {
        return this.handleError(error);
      }
    });

    // TODO: This is not working as expected, Presigned Download URLs are not working
    this.app.get('/api/v1/storage/download/:path', async ({ params }) => {
      try {
        const url = await this.storageAdapter.getPresignedDownloadUrl(
          this.storageAdapter.defaultBucket,
          params.path,
          3600 // 1 hour expiry
        );
        return {
          status: 'success',
          data: { url }
        };
      } catch (error) {
        return this.handleError(error);
      }
    });

    this.app.get('/api/v1/storage/upload-url/:path', async ({ params, query }) => {
      try {
        const options = {
          contentType: query.contentType as string,
          expires: parseInt(query.expires as string) || 3600
        };

        const result = await this.storageAdapter.getPresignedUploadUrl(params.path, options);
        return {
          status: 'success',
          data: result
        };
      } catch (error) {
        return this.handleError(error);
      }
    });

    this.app.get('/api/v1/storage/list/:prefix?', async ({ params, query }) => {
      try {
        const options = {
          maxResults: parseInt(query.maxResults as string) || 1000,
          pageToken: query.pageToken as string
        };

        const result = await this.storageAdapter.list(params.prefix || '', options);
        return {
          status: 'success',
          data: result
        };
      } catch (error) {
        return this.handleError(error);
      }
    });
  }

  private handleError(error: unknown) {
    if (error instanceof PhoenixStoreError) {
      return {
        status: 'error',
        code: error.code,
        message: error.message
      };
    }

    return {
      status: 'error',
      code: 'INTERNAL_SERVER_ERROR',
      message: 'An unexpected error occurred'
    };
  }

  public start(port: number) {
    // Force immediate flushing of console output
    console.log = (...args) => {
      process.stdout.write(args.join(' ') + '\n');
    };

    // Clear screen and show banner
    console.log('\x1Bc'); // Clear console
    console.log('='.repeat(50));
    console.log('[-] PhoenixStore Server');
    console.log('='.repeat(50));

    // Start HTTP server
    this.app.listen({
      port,
      hostname: '0.0.0.0'
    }, ({ hostname, port }) => {
      // Server status messages
      console.log('\n[*] Server Status:');
      console.log('-------------------');
      console.log(`[>] Mode: ${process.env.NODE_ENV || 'development'}`);
      console.log(`[>] Host: ${hostname === '0.0.0.0' ? 'All Interfaces (0.0.0.0)' : hostname}`);
      console.log(`[>] Port: ${port}`);
      console.log('\n[*] Access Points:');
      console.log('-------------------');
      console.log(`[+] Homepage: ${config.PHOENIXSTORE_API_URL}:${config.PHOENIXSTORE_PORT}`);
      console.log(`[+] Swagger UI: ${config.PHOENIXSTORE_API_URL}:${config.PHOENIXSTORE_PORT}/swagger`);
      console.log(`[+] API Base: ${config.PHOENIXSTORE_API_URL}:${config.PHOENIXSTORE_PORT}/api/v1`);
      console.log(`[+] MongoDB URL: ${config.MONGODB_HOST}:${config.MONGODB_PORT}`);
      console.log(`[+] Storage Docker Endpoint: ${config.STORAGE_ENDPOINT}`);
      console.log(`[+] Storage PublicURL: ${config.STORAGE_URL}:${config.STORAGE_PORT}`);
      console.log(`[+] Storage Console: ${config.STORAGE_URL}:${config.STORAGE_CONSOLE_PORT}`);
    });

    // Start WebSocket server
    this.wsServer = new WebSocketServer({
      port: config.WEBSOCKET_PORT,
      clientTracking: true,
      maxPayload: 50 * 1024 * 1024, // 50MB max payload
    });

    this.wsServer.on('connection', (ws: WS) => {
      this.store.getWebSocketManager().handleConnection(ws);
    });

    console.log(`[+] WebSocket: ws://${config.PHOENIXSTORE_API_URL.replace('http://', '')}:${config.WEBSOCKET_PORT}`);
    console.log('\n[!] Server is ready to accept connections\n');

    return this.app;
  }

  public async stop() {
    if (this.wsServer) {
      await new Promise<void>((resolve) => {
        this.wsServer?.close(() => resolve());
      });
    }
    await this.app.stop();
  }
} 