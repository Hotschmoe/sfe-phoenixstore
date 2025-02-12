import { Elysia } from 'elysia';
import { cors } from '@elysiajs/cors';
import { swagger } from '@elysiajs/swagger';
import { PhoenixStore } from '../core/PhoenixStore';
import { DocumentData, PhoenixStoreError } from '../types';
import { homeHtml } from './home';

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

  constructor(store: PhoenixStore) {
    this.store = store;
    this.app = new Elysia()
      .use(cors())
      .use(swagger({
        documentation: {
          info: {
            title: 'PhoenixStore API',
            version: '1.0.0'
          }
        }
      }));

    this.setupRoutes();
  }

  private setupRoutes() {
    // Root endpoint with API information
    this.app.get('/', () => {
      return new Response(homeHtml, {
        headers: {
          'Content-Type': 'text/html'
        }
      });
    });

    // Create document
    this.app.post('/api/v1/:collection', async ({ params, body }) => {
      try {
        const collection = this.store.collection(params.collection);
        const id = await collection.add(body as DocumentData);
        return { id, status: 'success' };
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
            ...data
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
        await collection.doc(params.id).update(body as DocumentData);
        return { status: 'success' };
      } catch (error) {
        return this.handleError(error);
      }
    });

    // Delete document
    this.app.delete('/api/v1/:collection/:id', async ({ params }) => {
      try {
        const collection = this.store.collection(params.collection);
        await collection.doc(params.id).delete();
        return { status: 'success' };
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
    console.log('🔥  PhoenixStore Server');
    console.log('='.repeat(50));

    this.app.listen({
      port,
      hostname: '0.0.0.0'
    }, ({ hostname, port }) => {
      // Server status messages
      console.log('\n📡 Server Status:');
      console.log('-------------------');
      console.log(`⚡ Mode: ${process.env.NODE_ENV || 'development'}`);
      console.log(`🌐 Host: ${hostname === '0.0.0.0' ? 'All Interfaces (0.0.0.0)' : hostname}`);
      console.log(`🚪 Port: ${port}`);
      console.log('\n📍 Access Points:');
      console.log('-------------------');
      console.log(`🏠 Homepage: http://localhost:${port}`);
      console.log(`📚 Swagger UI: http://localhost:${port}/swagger`);
      console.log(`🔌 API Base: http://localhost:${port}/api/v1`);
      console.log('\n✨ Server is ready to accept connections\n');
    });
  }
} 