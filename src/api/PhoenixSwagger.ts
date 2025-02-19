import { swagger } from '@elysiajs/swagger';

export const swaggerPlugin = swagger({
  documentation: {
    info: {
      title: 'PhoenixStore API',
      version: '1.0.0',
      description: 'MongoDB-based Firestore alternative with familiar syntax and Firebase Storage-like file handling'
    },
    tags: [
      { name: 'Documents', description: 'Document operations (create, read, update, delete)' },
      { name: 'Queries', description: 'Collection queries with Firestore-like syntax' },
      { name: 'Authentication', description: 'User authentication and management' },
      { name: 'Storage', description: 'File storage operations (Firebase Storage-like)' }
    ],
    components: {
      schemas: {
        QueryParams: {
          type: 'object',
          properties: {
            where: {
              type: 'array',
              items: {
                type: 'string',
                description: 'Filter condition in format field:operator:value',
                example: 'age:>:21'
              },
              description: 'Array of filter conditions. Each condition follows format: field:operator:value',
              example: [
                'age:>:21',
                'city:==:London',
                'tags:array-contains:[news]',
                'category:in:[electronics,books]',
                'status:!=:deleted',
                'price:>=:100',
                'features:array-contains-any:[wifi,bluetooth]'
              ]
            },
            orderBy: {
              oneOf: [
                {
                  type: 'string',
                  description: 'Sort field and direction in format field:direction (direction is optional, defaults to asc)',
                  example: 'name:desc'
                },
                {
                  type: 'array',
                  items: {
                    type: 'string',
                    description: 'Sort field and direction',
                    example: 'name:desc'
                  },
                  description: 'Multiple sort fields in order of priority'
                }
              ]
            },
            limit: {
              type: 'number',
              description: 'Maximum number of results to return (1-1000)',
              minimum: 1,
              maximum: 1000,
              example: 10
            },
            offset: {
              type: 'number',
              description: 'Number of results to skip (for pagination)',
              minimum: 0,
              example: 20
            }
          }
        },
        QueryOperators: {
          type: 'string',
          enum: ['==', '!=', '<', '<=', '>', '>=', 'in', 'not-in', 'array-contains', 'array-contains-any'],
          description: 'Supported query operators',
          example: {
            equals: {
              value: '==',
              description: 'Equal to'
            },
            notEquals: {
              value: '!=',
              description: 'Not equal to'
            },
            lessThan: {
              value: '<',
              description: 'Less than'
            },
            lessThanEqual: {
              value: '<=',
              description: 'Less than or equal to'
            },
            greaterThan: {
              value: '>',
              description: 'Greater than'
            },
            greaterThanEqual: {
              value: '>=',
              description: 'Greater than or equal to'
            },
            in: {
              value: 'in',
              description: 'Value is in array',
              example: 'category:in:[electronics,books]'
            },
            notIn: {
              value: 'not-in',
              description: 'Value is not in array',
              example: 'status:not-in:[deleted,archived]'
            },
            arrayContains: {
              value: 'array-contains',
              description: 'Array field contains value',
              example: 'tags:array-contains:[news]'
            },
            arrayContainsAny: {
              value: 'array-contains-any',
              description: 'Array field contains any of the values',
              example: 'features:array-contains-any:[wifi,bluetooth]'
            }
          }
        },
        EmailOptions: {
          type: 'object',
          required: ['to', 'subject'],
          properties: {
            to: {
              type: 'string',
              format: 'email',
              description: 'Recipient email address',
              example: 'recipient@example.com'
            },
            subject: {
              type: 'string',
              description: 'Email subject line',
              example: 'Welcome to PhoenixStore'
            },
            text: {
              type: 'string',
              description: 'Plain text email content',
              example: 'This is a plain text email message.'
            },
            html: {
              type: 'string',
              description: 'HTML formatted email content',
              example: '<h1>Welcome</h1><p>This is an HTML email message.</p>'
            }
          }
        },
        CreateUserParams: {
          type: 'object',
          required: ['email', 'password'],
          properties: {
            email: {
              type: 'string',
              format: 'email',
              description: 'User email address',
              example: 'user@example.com'
            },
            password: {
              type: 'string',
              description: 'User password (8-128 chars, uppercase, lowercase, number, special char)',
              example: 'StrongP@ss123'
            },
            displayName: {
              type: 'string',
              description: 'User display name',
              example: 'John Doe'
            },
            photoURL: {
              type: 'string',
              description: 'URL to user profile photo',
              example: 'https://example.com/photo.jpg'
            }
          }
        },
        SignInParams: {
          type: 'object',
          required: ['email', 'password'],
          properties: {
            email: {
              type: 'string',
              format: 'email',
              description: 'User email address',
              example: 'user@example.com'
            },
            password: {
              type: 'string',
              description: 'User password',
              example: 'StrongP@ss123'
            }
          }
        },
        AuthTokens: {
          type: 'object',
          properties: {
            accessToken: {
              type: 'string',
              description: 'JWT access token'
            },
            refreshToken: {
              type: 'string',
              description: 'JWT refresh token'
            },
            expiresIn: {
              type: 'number',
              description: 'Token expiration time in seconds'
            }
          }
        },
        RefreshTokenParams: {
          type: 'object',
          required: ['refreshToken'],
          properties: {
            refreshToken: {
              type: 'string',
              description: 'JWT refresh token'
            }
          }
        },
        EmailVerificationParams: {
          type: 'object',
          required: ['token'],
          properties: {
            token: {
              type: 'string',
              description: 'Email verification token'
            }
          }
        },
        PasswordResetParams: {
          type: 'object',
          required: ['token', 'newPassword'],
          properties: {
            token: {
              type: 'string',
              description: 'Password reset token'
            },
            newPassword: {
              type: 'string',
              description: 'New password (8-128 chars, uppercase, lowercase, number, special char)',
              example: 'NewStrongP@ss123'
            }
          }
        },
        Error: {
          type: 'object',
          properties: {
            status: { 
              type: 'string',
              enum: ['error'],
              example: 'error'
            },
            code: { 
              type: 'string',
              enum: [
                'INVALID_QUERY_PARAMS',
                'INVALID_OPERATOR',
                'DOCUMENT_NOT_FOUND',
                'MONGODB_CONNECTION_ERROR',
                'MONGODB_NOT_CONNECTED',
                'QUERY_ERROR',
                'INVALID_EMAIL',
                'INVALID_PASSWORD',
                'EMAIL_EXISTS',
                'USER_NOT_FOUND',
                'USER_DISABLED',
                'ACCOUNT_LOCKED',
                'TOKEN_EXPIRED',
                'TOKEN_REVOKED',
                'INVALID_TOKEN',
                'EMAIL_ALREADY_VERIFIED',
                'EMAIL_SEND_ERROR'
              ],
              example: 'INVALID_QUERY_PARAMS'
            },
            message: { 
              type: 'string',
              example: 'Invalid query parameters'
            }
          }
        },
        DocumentResponse: {
          type: 'object',
          properties: {
            status: {
              type: 'string',
              enum: ['success'],
              example: 'success'
            },
            data: {
              type: 'object',
              description: 'Document data with metadata',
              properties: {
                id: {
                  type: 'string',
                  description: 'Document ID'
                },
                path: {
                  type: 'string',
                  description: 'Full document path',
                  example: 'users/abc123'
                },
                data: {
                  type: 'object',
                  description: 'Document data',
                  additionalProperties: true
                }
              }
            }
          }
        },
        QueryResponse: {
          type: 'object',
          properties: {
            status: {
              type: 'string',
              enum: ['success'],
              example: 'success'
            },
            data: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  id: {
                    type: 'string',
                    description: 'Document ID'
                  },
                  data: {
                    type: 'object',
                    description: 'Document data',
                    additionalProperties: true
                  }
                }
              }
            }
          }
        },
        StorageFile: {
          type: 'object',
          properties: {
            name: {
              type: 'string',
              description: 'File name from path',
              example: 'profile.jpg'
            },
            bucket: {
              type: 'string',
              description: 'Storage bucket name (default: phoenixstore)',
              example: 'phoenixstore'
            },
            path: {
              type: 'string',
              description: 'Full path in storage (Firebase-like path structure)',
              example: 'users/123/profile.jpg'
            },
            contentType: {
              type: 'string',
              description: 'MIME type',
              example: 'image/jpeg'
            },
            size: {
              type: 'number',
              description: 'File size in bytes',
              example: 1024
            },
            metadata: {
              type: 'object',
              description: 'Custom metadata',
              additionalProperties: {
                type: 'string'
              },
              example: {
                userId: '123',
                purpose: 'profile'
              }
            },
            createdAt: {
              type: 'string',
              format: 'date-time',
              description: 'Creation timestamp'
            },
            updatedAt: {
              type: 'string',
              format: 'date-time',
              description: 'Last modification timestamp'
            },
            url: {
              type: 'string',
              description: 'Public URL',
              example: 'http://storage.example.com/phoenixstore/users/123/profile.jpg'
            }
          }
        },
        StorageListResult: {
          type: 'object',
          properties: {
            files: {
              type: 'array',
              items: {
                $ref: '#/components/schemas/StorageFile'
              },
              description: 'Array of files in the current directory'
            },
            prefixes: {
              type: 'array',
              items: {
                type: 'string'
              },
              description: 'Array of folder paths (prefixes)',
              example: ['users/', 'users/123/images/']
            },
            nextPageToken: {
              type: 'string',
              description: 'Token for retrieving the next page of results',
              example: 'users/123/profile.jpg'
            }
          }
        },
        StorageListOptions: {
          type: 'object',
          properties: {
            maxResults: {
              type: 'number',
              description: 'Maximum number of results to return',
              example: 1000
            },
            pageToken: {
              type: 'string',
              description: 'Page token from a previous list operation',
              example: 'users/123/profile.jpg'
            }
          }
        },
        UploadOptions: {
          type: 'object',
          properties: {
            contentType: {
              type: 'string',
              description: 'Override content type',
              example: 'image/jpeg'
            },
            metadata: {
              type: 'object',
              description: 'Custom metadata',
              additionalProperties: {
                type: 'string'
              },
              example: {
                userId: '123',
                purpose: 'profile'
              }
            }
          }
        },
        PresignedUrlOptions: {
          type: 'object',
          properties: {
            contentType: {
              type: 'string',
              description: 'Override content type',
              example: 'image/jpeg'
            },
            expires: {
              type: 'number',
              description: 'URL expiration in seconds',
              example: 3600
            }
          }
        },
        StorageError: {
          type: 'object',
          properties: {
            code: {
              type: 'string',
              enum: [
                'storage/unknown',
                'storage/object-not-found',
                'storage/bucket-not-found',
                'storage/upload-failed',
                'storage/invalid-url'
              ],
              example: 'storage/object-not-found'
            },
            message: {
              type: 'string',
              example: 'File does not exist'
            }
          }
        },
        WebSocketMessage: {
          type: 'object',
          required: ['type'],
          properties: {
            type: {
              type: 'string',
              enum: ['connected', 'auth', 'watch_document', 'watch_collection', 'presence', 'unwatch'],
              description: 'Message type'
            },
            requestId: {
              type: 'string',
              description: 'Unique request identifier for message correlation'
            }
          }
        },
        WebSocketAuthRequest: {
          type: 'object',
          required: ['type', 'requestId', 'token'],
          properties: {
            type: {
              type: 'string',
              enum: ['auth'],
              description: 'Authentication request'
            },
            requestId: {
              type: 'string',
              description: 'Unique request identifier'
            },
            token: {
              type: 'string',
              description: 'JWT authentication token'
            }
          }
        },
        WebSocketWatchDocumentRequest: {
          type: 'object',
          required: ['type', 'requestId', 'collection', 'documentId'],
          properties: {
            type: {
              type: 'string',
              enum: ['watch_document'],
              description: 'Watch document request'
            },
            requestId: {
              type: 'string',
              description: 'Unique request identifier'
            },
            collection: {
              type: 'string',
              description: 'Collection name'
            },
            documentId: {
              type: 'string',
              description: 'Document ID to watch'
            }
          }
        },
        WebSocketWatchCollectionRequest: {
          type: 'object',
          required: ['type', 'requestId', 'collection'],
          properties: {
            type: {
              type: 'string',
              enum: ['watch_collection'],
              description: 'Watch collection request'
            },
            requestId: {
              type: 'string',
              description: 'Unique request identifier'
            },
            collection: {
              type: 'string',
              description: 'Collection name'
            },
            query: {
              type: 'object',
              properties: {
                where: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      field: { type: 'string' },
                      operator: { type: 'string' },
                      value: { 
                        oneOf: [
                          { type: 'string' },
                          { type: 'number' },
                          { type: 'boolean' },
                          { type: 'array', items: { type: 'string' } },
                          { type: 'array', items: { type: 'number' } }
                        ]
                      }
                    }
                  }
                },
                orderBy: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      field: { type: 'string' },
                      direction: { type: 'string', enum: ['asc', 'desc'] }
                    }
                  }
                }
              }
            }
          }
        },
        WebSocketPresenceRequest: {
          type: 'object',
          required: ['type', 'requestId', 'action', 'status'],
          properties: {
            type: {
              type: 'string',
              enum: ['presence'],
              description: 'Presence update request'
            },
            requestId: {
              type: 'string',
              description: 'Unique request identifier'
            },
            action: {
              type: 'string',
              enum: ['update'],
              description: 'Presence action'
            },
            status: {
              type: 'string',
              description: 'User status'
            },
            metadata: {
              type: 'object',
              description: 'Optional presence metadata',
              additionalProperties: true
            }
          }
        },
        WebSocketUnwatchRequest: {
          type: 'object',
          required: ['type', 'requestId', 'subscriptionId'],
          properties: {
            type: {
              type: 'string',
              enum: ['unwatch'],
              description: 'Unwatch request'
            },
            requestId: {
              type: 'string',
              description: 'Unique request identifier'
            },
            subscriptionId: {
              type: 'string',
              description: 'Subscription ID to unwatch'
            }
          }
        },
        DocumentChange: {
          type: 'object',
          properties: {
            type: {
              type: 'string',
              enum: ['added', 'modified', 'removed'],
              description: 'Type of change'
            },
            data: {
              type: 'object',
              description: 'Document data',
              additionalProperties: true
            }
          }
        },
        CollectionChange: {
          type: 'object',
          properties: {
            type: {
              type: 'string',
              enum: ['added', 'modified', 'removed'],
              description: 'Type of change'
            },
            changes: {
              type: 'array',
              items: {
                $ref: '#/components/schemas/DocumentChange'
              },
              description: 'Array of document changes'
            }
          }
        }
      },
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'JWT Authorization header using the Bearer scheme'
        }
      }
    },
    security: [
      {
        bearerAuth: []
      }
    ],
    paths: {
      '/api/v1/{collection}': {
        get: {
          tags: ['Queries'],
          summary: 'Query documents in a collection',
          description: `
Query documents in a collection using Firestore-like syntax.

Examples:
\`\`\`
# Basic equality
GET /api/v1/users?where=age:==:21

# Multiple conditions
GET /api/v1/users?where=age:>:21&where=city:==:London

# Array operations
GET /api/v1/posts?where=tags:array-contains:[news]
GET /api/v1/products?where=category:in:[electronics,books]

# Sorting and pagination
GET /api/v1/users?orderBy=name:asc&limit=10
GET /api/v1/posts?where=published:==:true&orderBy=date:desc&limit=20&offset=40

# Complex queries
GET /api/v1/products?where=price:>=:100&where=category:in:[electronics,books]&where=features:array-contains:[wifi]&orderBy=price:desc
\`\`\`
`,
          parameters: [
            {
              name: 'collection',
              in: 'path',
              required: true,
              schema: {
                type: 'string'
              },
              description: 'Collection name'
            },
            {
              name: 'where',
              in: 'query',
              required: false,
              schema: {
                oneOf: [
                  {
                    type: 'string'
                  },
                  {
                    type: 'array',
                    items: {
                      type: 'string'
                    }
                  }
                ]
              },
              description: 'Query conditions in format field:operator:value'
            },
            {
              name: 'orderBy',
              in: 'query',
              required: false,
              schema: {
                oneOf: [
                  {
                    type: 'string'
                  },
                  {
                    type: 'array',
                    items: {
                      type: 'string'
                    }
                  }
                ]
              },
              description: 'Sort field and direction in format field:direction'
            },
            {
              name: 'limit',
              in: 'query',
              required: false,
              schema: {
                type: 'number',
                minimum: 1,
                maximum: 1000
              },
              description: 'Maximum number of results to return'
            },
            {
              name: 'offset',
              in: 'query',
              required: false,
              schema: {
                type: 'number',
                minimum: 0
              },
              description: 'Number of results to skip'
            }
          ],
          responses: {
            '200': {
              description: 'Query results',
              content: {
                'application/json': {
                  schema: {
                    $ref: '#/components/schemas/QueryResponse'
                  }
                }
              }
            },
            '400': {
              description: 'Invalid query parameters',
              content: {
                'application/json': {
                  schema: {
                    $ref: '#/components/schemas/Error'
                  }
                }
              }
            }
          }
        },
        post: {
          tags: ['Documents'],
          summary: 'Create a new document',
          description: 'Create a new document in the specified collection',
          parameters: [
            {
              name: 'collection',
              in: 'path',
              required: true,
              schema: {
                type: 'string'
              },
              description: 'Collection name'
            }
          ],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  additionalProperties: true
                }
              }
            }
          },
          responses: {
            '200': {
              description: 'Document created successfully',
              content: {
                'application/json': {
                  schema: {
                    $ref: '#/components/schemas/DocumentResponse'
                  }
                }
              }
            }
          }
        }
      },
      '/api/v1/{collection}/{id}': {
        get: {
          tags: ['Documents'],
          summary: 'Get a document by ID',
          description: 'Retrieve a document by its ID from the specified collection',
          parameters: [
            {
              name: 'collection',
              in: 'path',
              required: true,
              schema: {
                type: 'string'
              },
              description: 'Collection name'
            },
            {
              name: 'id',
              in: 'path',
              required: true,
              schema: {
                type: 'string'
              },
              description: 'Document ID'
            }
          ],
          responses: {
            '200': {
              description: 'Document retrieved successfully',
              content: {
                'application/json': {
                  schema: {
                    $ref: '#/components/schemas/DocumentResponse'
                  }
                }
              }
            },
            '404': {
              description: 'Document not found',
              content: {
                'application/json': {
                  schema: {
                    $ref: '#/components/schemas/Error'
                  }
                }
              }
            }
          }
        },
        put: {
          tags: ['Documents'],
          summary: 'Update a document',
          description: 'Update an existing document in the specified collection',
          parameters: [
            {
              name: 'collection',
              in: 'path',
              required: true,
              schema: {
                type: 'string'
              },
              description: 'Collection name'
            },
            {
              name: 'id',
              in: 'path',
              required: true,
              schema: {
                type: 'string'
              },
              description: 'Document ID'
            }
          ],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  additionalProperties: true
                }
              }
            }
          },
          responses: {
            '200': {
              description: 'Document updated successfully',
              content: {
                'application/json': {
                  schema: {
                    $ref: '#/components/schemas/DocumentResponse'
                  }
                }
              }
            },
            '404': {
              description: 'Document not found',
              content: {
                'application/json': {
                  schema: {
                    $ref: '#/components/schemas/Error'
                  }
                }
              }
            }
          }
        },
        delete: {
          tags: ['Documents'],
          summary: 'Delete a document',
          description: 'Delete a document from the specified collection',
          parameters: [
            {
              name: 'collection',
              in: 'path',
              required: true,
              schema: {
                type: 'string'
              },
              description: 'Collection name'
            },
            {
              name: 'id',
              in: 'path',
              required: true,
              schema: {
                type: 'string'
              },
              description: 'Document ID'
            }
          ],
          responses: {
            '200': {
              description: 'Document deleted successfully',
              content: {
                'application/json': {
                  schema: {
                    $ref: '#/components/schemas/DocumentResponse'
                  }
                }
              }
            },
            '404': {
              description: 'Document not found',
              content: {
                'application/json': {
                  schema: {
                    $ref: '#/components/schemas/Error'
                  }
                }
              }
            }
          }
        }
      }
    }
  }
}); 