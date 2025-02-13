import { Elysia } from 'elysia';
import { cors } from '@elysiajs/cors';
import { PhoenixStore } from '../core/PhoenixStore';
import { DocumentData, PhoenixStoreError, QueryOperator } from '../types';
import { homeHtml } from './home';
import { swaggerPlugin } from './PhoenixSwagger';

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
      .use(swaggerPlugin);

    this.setupRoutes();
  }

  private parseQueryParams(query: any) {
    const conditions = [];
    const options: { orderBy?: string; orderDirection?: 'asc' | 'desc'; limit?: number; offset?: number } = {};

    // Parse where conditions (field:operator:value)
    if (query.where) {
      const whereConditions = Array.isArray(query.where) ? query.where : [query.where];
      for (const condition of whereConditions) {
        const [field, operator, value] = condition.split(':');
        if (!field || !operator || value === undefined) {
          throw new PhoenixStoreError(
            'Invalid where condition format. Expected field:operator:value',
            'INVALID_QUERY_PARAMS'
          );
        }
        
        // Validate operator
        if (!['==', '!=', '<', '<=', '>', '>=', 'in', 'not-in'].includes(operator)) {
          throw new PhoenixStoreError(
            `Invalid operator: ${operator}`,
            'INVALID_QUERY_PARAMS'
          );
        }

        // Parse value based on type
        let parsedValue = value;
        if (value.startsWith('[') && value.endsWith(']')) {
          // Parse array values for 'in' and 'not-in' operators
          try {
            parsedValue = JSON.parse(value);
          } catch {
            throw new PhoenixStoreError(
              'Invalid array format in where condition',
              'INVALID_QUERY_PARAMS'
            );
          }
        } else if (value === 'true' || value === 'false') {
          parsedValue = value === 'true';
        } else if (!isNaN(Number(value))) {
          parsedValue = Number(value);
        }

        conditions.push({
          field,
          operator: operator as QueryOperator,
          value: parsedValue
        });
      }
    }

    // Parse orderBy
    if (query.orderBy) {
      const [field, direction] = query.orderBy.split(':');
      options.orderBy = field;
      options.orderDirection = (direction?.toLowerCase() || 'asc') as 'asc' | 'desc';
    }

    // Parse pagination
    if (query.limit) {
      const limit = parseInt(query.limit);
      if (isNaN(limit) || limit < 1) {
        throw new PhoenixStoreError(
          'Invalid limit parameter',
          'INVALID_QUERY_PARAMS'
        );
      }
      options.limit = limit;
    }

    if (query.offset) {
      const offset = parseInt(query.offset);
      if (isNaN(offset) || offset < 0) {
        throw new PhoenixStoreError(
          'Invalid offset parameter',
          'INVALID_QUERY_PARAMS'
        );
      }
      options.offset = offset;
    }

    return { conditions, options };
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

    // Query collection
    this.app.get('/api/v1/:collection', async ({ params, query }) => {
      try {
        const collection = this.store.collection(params.collection);
        const { conditions, options } = this.parseQueryParams(query);
        
        // Start with first condition or orderBy to get Query object
        let queryBuilder = conditions.length > 0
          ? collection.where(conditions[0].field, conditions[0].operator, conditions[0].value)
          : collection.orderBy(options.orderBy || 'id', options.orderDirection);

        // Add remaining conditions
        for (let i = 1; i < conditions.length; i++) {
          const condition = conditions[i];
          queryBuilder = queryBuilder.where(condition.field, condition.operator, condition.value);
        }
        
        // Add remaining options
        if (options.orderBy && conditions.length > 0) {
          queryBuilder = queryBuilder.orderBy(options.orderBy, options.orderDirection);
        }
        if (options.limit) {
          queryBuilder = queryBuilder.limit(options.limit);
        }
        if (options.offset) {
          queryBuilder = queryBuilder.offset(options.offset);
        }
        
        const results = await queryBuilder.get();
        return {
          status: 'success',
          data: results
        };
      } catch (error) {
        return this.handleError(error);
      }
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
    console.log('[-] PhoenixStore Server');
    console.log('='.repeat(50));

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
      console.log(`[+] Homepage: http://localhost:${port}`);
      console.log(`[+] Swagger UI: http://localhost:${port}/swagger`);
      console.log(`[+] API Base: http://localhost:${port}/api/v1`);
      console.log('\n[!] Server is ready to accept connections\n');
    });
  }
} 