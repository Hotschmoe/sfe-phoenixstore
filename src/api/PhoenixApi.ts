import { Elysia } from 'elysia';
import { cors } from '@elysiajs/cors';
import { swagger } from '@elysiajs/swagger';
import { PhoenixStore } from '../core/PhoenixStore';
import { DocumentData, PhoenixStoreError } from '../types';

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
    this.app.listen(port);
    console.log(`🚀 PhoenixStore API running at http://localhost:${port}`);
    console.log(`📚 Swagger docs available at http://localhost:${port}/swagger`);
  }
} 