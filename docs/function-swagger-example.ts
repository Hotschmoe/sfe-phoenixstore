// src/functions/decorators.ts
import 'reflect-metadata';

const FUNCTION_METADATA_KEY = 'phoenix:function';

export interface FunctionMetadata {
  name: string;
  description?: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  path: string;
  params?: {
    name: string;
    type: string;
    description?: string;
    required?: boolean;
  }[];
  responses?: {
    status: number;
    description: string;
    schema?: any;
  }[];
  tags?: string[];
}

// Function decorator that captures OpenAPI metadata
export function PhoenixFunction(metadata: FunctionMetadata) {
  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    Reflect.defineMetadata(FUNCTION_METADATA_KEY, metadata, target, propertyKey);
    return descriptor;
  };
}

// Example parameter decorators
export function Param(name: string, description?: string) {
  return function (target: any, propertyKey: string, parameterIndex: number) {
    const params = Reflect.getMetadata('phoenix:params', target, propertyKey) || [];
    params.push({ name, description, index: parameterIndex });
    Reflect.defineMetadata('phoenix:params', params, target, propertyKey);
  };
}

// src/functions/discovery.ts
export class FunctionDiscovery {
  private static functionRegistry: Map<string, FunctionMetadata> = new Map();

  static registerFunction(path: string, metadata: FunctionMetadata) {
    this.functionRegistry.set(path, metadata);
  }

  static getFunctions(): Map<string, FunctionMetadata> {
    return this.functionRegistry;
  }

  static getSwaggerPaths() {
    const paths: Record<string, any> = {};
    
    this.functionRegistry.forEach((metadata, path) => {
      const method = metadata.method.toLowerCase();
      paths[path] = {
        [method]: {
          tags: metadata.tags || ['Functions'],
          summary: metadata.name,
          description: metadata.description,
          parameters: metadata.params?.map(param => ({
            name: param.name,
            in: method === 'get' ? 'query' : 'body',
            description: param.description,
            required: param.required,
            schema: {
              type: param.type
            }
          })),
          responses: metadata.responses?.reduce((acc, response) => {
            acc[response.status] = {
              description: response.description,
              content: response.schema ? {
                'application/json': {
                  schema: response.schema
                }
              } : undefined
            };
            return acc;
          }, {} as Record<string, any>)
        }
      };
    });

    return paths;
  }
}

// Example function implementation
export class UserFunctions {
  @PhoenixFunction({
    name: 'Create User Profile',
    description: 'Creates a new user profile after signup',
    method: 'POST',
    path: '/functions/users/profile',
    tags: ['User Functions'],
    params: [
      {
        name: 'displayName',
        type: 'string',
        description: 'User display name',
        required: true
      },
      {
        name: 'photoURL',
        type: 'string',
        description: 'Profile photo URL',
        required: false
      }
    ],
    responses: [
      {
        status: 200,
        description: 'Profile created successfully',
        schema: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            displayName: { type: 'string' },
            photoURL: { type: 'string' },
            createdAt: { type: 'string', format: 'date-time' }
          }
        }
      },
      {
        status: 400,
        description: 'Invalid input parameters'
      }
    ]
  })
  async createUserProfile(@Param('displayName') displayName: string, @Param('photoURL') photoURL?: string) {
    // Function implementation
  }
}

// Integration with Elysia Swagger
import { swagger } from '@elysiajs/swagger';

// src/api/PhoenixSwagger.ts
export const swaggerPlugin = swagger({
  documentation: {
    info: {
      title: 'PhoenixStore API',
      version: '1.0.0'
    },
    paths: {
      ...FunctionDiscovery.getSwaggerPaths()
    }
  }
});

// Usage in function files
// functions/userFunctions.ts
export class UserFunctions {
  @PhoenixFunction({
    name: 'Delete Inactive Users',
    description: 'Removes users who have been inactive for more than 30 days',
    method: 'POST',
    path: '/functions/maintenance/cleanup-users',
    tags: ['Maintenance'],
    params: [
      {
        name: 'dryRun',
        type: 'boolean',
        description: 'If true, only returns the users that would be deleted',
        required: false
      },
      {
        name: 'inactiveDays',
        type: 'number',
        description: 'Number of days of inactivity before deletion',
        required: false
      }
    ],
    responses: [
      {
        status: 200,
        description: 'Cleanup completed successfully',
        schema: {
          type: 'object',
          properties: {
            deletedCount: { type: 'number' },
            users: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  id: { type: 'string' },
                  lastActive: { type: 'string', format: 'date-time' }
                }
              }
            }
          }
        }
      }
    ]
  })
  async cleanupInactiveUsers(dryRun: boolean = true, inactiveDays: number = 30) {
    // Implementation
  }
}
