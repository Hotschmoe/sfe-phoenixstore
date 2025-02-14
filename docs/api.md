# PhoenixStore API Documentation

## Overview

PhoenixStore provides a RESTful API that follows Firestore-like patterns for easy adoption. This document details all available endpoints, request/response formats, and examples.

## Base URL

```
http://localhost:3000/api/v1
```

## Authentication

> 🚧 Authentication is planned for future implementation. The current version operates without authentication.

Future authentication will use JWT tokens:
```http
Authorization: Bearer <your_jwt_token>
```

## Response Format

All responses follow a consistent format:

### Success Response
```json
{
  "status": "success",
  "data": {
    // Response data
  }
}
```

### Error Response
```json
{
  "status": "error",
  "code": "ERROR_CODE",
  "message": "Human readable error message"
}
```

## Common Error Codes

| Code | Description |
|------|-------------|
| `DOCUMENT_NOT_FOUND` | The requested document does not exist |
| `INVALID_ID` | The provided document ID is invalid |
| `MONGODB_CONNECTION_ERROR` | Database connection error |
| `INTERNAL_SERVER_ERROR` | Unexpected server error |

## Endpoints

### Create Document
Creates a new document in a collection.

```http
POST /:collection
```

#### Request Body
```json
{
  "field1": "value1",
  "field2": "value2"
  // ... any valid JSON data
}
```

#### Response
```json
{
  "status": "success",
  "id": "generated_document_id"
}
```

#### Example
```bash
curl -X POST http://localhost:3000/api/v1/users \
  -H "Content-Type: application/json" \
  -d '{"name": "John Doe", "email": "john@example.com"}'
```

### Read Document
Retrieves a document by ID.

```http
GET /:collection/:id
```

#### Response
```json
{
  "status": "success",
  "data": {
    "id": "document_id",
    "field1": "value1",
    "field2": "value2"
  }
}
```

#### Example
```bash
curl http://localhost:3000/api/v1/users/123456
```

### Update Document
Updates an existing document.

```http
PUT /:collection/:id
```

#### Request Body
```json
{
  "field1": "new_value"
  // ... fields to update
}
```

#### Response
```json
{
  "status": "success"
}
```

#### Example
```bash
curl -X PUT http://localhost:3000/api/v1/users/123456 \
  -H "Content-Type: application/json" \
  -d '{"name": "Jane Doe"}'
```

### Delete Document
Deletes a document.

```http
DELETE /:collection/:id
```

#### Response
```json
{
  "status": "success"
}
```

#### Example
```bash
curl -X DELETE http://localhost:3000/api/v1/users/123456
```

## Query Operations

The following query operations are available:

### Query Parameters

| Parameter | Description | Example |
|-----------|-------------|---------|
| `where` | Filter condition | `field:operator:value` |
| `orderBy` | Sort field and direction | `field:direction` |
| `limit` | Maximum number of results | `10` |
| `offset` | Number of results to skip | `20` |

### Supported Operators

| Operator | Description | Example |
|----------|-------------|---------|
| `==` | Equals | `age:==:25` |
| `!=` | Not equals | `city:!=:London` |
| `>` | Greater than | `age:>:18` |
| `>=` | Greater than or equal | `score:>=:90` |
| `<` | Less than | `price:<:100` |
| `<=` | Less than or equal | `quantity:<=:50` |
| `in` | In array | `status:in:[active,pending]` |
| `not-in` | Not in array | `category:not-in:[archived,deleted]` |
| `array-contains` | Array contains value | `tags:array-contains:developer` |
| `array-contains-any` | Array contains any value | `roles:array-contains-any:[admin,moderator]` |

Example queries:
```http
# Basic query with single condition
GET /api/v1/users?where=age:>:21

# Multiple conditions
GET /api/v1/users?where=age:>:21&where=city:==:London

# Sorting and pagination
GET /api/v1/users?orderBy=name:asc&limit=10&offset=20

# Complex query with array operations
GET /api/v1/users?where=tags:array-contains:developer&where=active:==:true

# Combined query with sorting and filtering
GET /api/v1/users?where=age:>=:25&where=score:>:80&orderBy=score:desc&limit=5
```

## Rate Limiting

> 🚧 Rate limiting is planned for future implementation.

## Swagger Documentation

Interactive API documentation is available at:
```
http://localhost:3000/swagger
```

## SDK Integration Notes

The API is designed to be easily integrated with SDKs. Key considerations:

1. **Consistent Response Format**
   - All endpoints follow the same response structure
   - Error handling is consistent across all operations

2. **Firestore-like Patterns**
   - Endpoint structure mirrors Firestore
   - Query parameters will match Firestore syntax

3. **Future SDK Methods**
   ```dart
   // Flutter SDK Example (Future Implementation)
   final db = PhoenixStore.instance;
   
   // Create
   final docRef = await db.collection('users').add({
     'name': 'John Doe',
     'email': 'john@example.com'
   });
   
   // Read
   final doc = await db.collection('users').doc('123').get();
   
   // Update
   await db.collection('users').doc('123').update({
     'name': 'Jane Doe'
   });
   
   // Delete
   await db.collection('users').doc('123').delete();
   ``` 