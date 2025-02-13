import { swagger } from '@elysiajs/swagger';

export const swaggerPlugin = swagger({
  documentation: {
    info: {
      title: 'PhoenixStore API',
      version: '1.0.0',
      description: 'MongoDB-based Firestore alternative with familiar syntax'
    },
    tags: [
      { name: 'Documents', description: 'Document operations' },
      { name: 'Queries', description: 'Query operations' }
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
              example: ['age:>:21', 'city:==:London', 'tags:in:[1,2,3]']
            },
            orderBy: {
              type: 'string',
              description: 'Sort field and direction in format field:direction (direction is optional, defaults to asc)',
              example: 'name:desc'
            },
            limit: {
              type: 'number',
              description: 'Maximum number of results to return',
              example: 10
            },
            offset: {
              type: 'number',
              description: 'Number of results to skip (for pagination)',
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
              description: 'Value is in array'
            },
            notIn: {
              value: 'not-in',
              description: 'Value is not in array'
            },
            arrayContains: {
              value: 'array-contains',
              description: 'Array field contains value'
            },
            arrayContainsAny: {
              value: 'array-contains-any',
              description: 'Array field contains any of the values'
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
                'QUERY_ERROR'
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
                }
              },
              additionalProperties: true
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
                  }
                },
                additionalProperties: true
              }
            }
          }
        }
      }
    }
  }
}); 