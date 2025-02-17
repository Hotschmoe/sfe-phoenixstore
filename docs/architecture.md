# PhoenixStore Architecture

## Overview

PhoenixStore is designed as a Firestore alternative for Flutter/Web projects, providing a familiar API with MongoDB as the backend. This document outlines the architectural decisions and system design.

## System Architecture

```mermaid
graph TB
    Client[Client Application]
    API[PhoenixStore API]
    Core[PhoenixStore Core]
    Adapter[MongoDB Adapter]
    DB[(MongoDB)]
    Express[Mongo Express]
    
    Client -->|REST Requests| API
    API -->|Internal Calls| Core
    Core -->|Database Operations| Adapter
    Adapter -->|MongoDB Driver| DB
    Express -->|Admin Interface| DB

    subgraph Docker Environment
        API
        Core
        Adapter
        DB
        Express
    end

    subgraph Future SDKs
        Flutter[Flutter SDK]
        Web[Web SDK]
        Flutter -.->|Future Implementation| API
        Web -.->|Future Implementation| API
    end
```

## Component Details

### 1. PhoenixStore API (REST Layer)
- Built with Elysia.js for high performance
- RESTful endpoints following Firestore patterns
- Swagger documentation for API exploration
- CORS support for cross-origin requests
- Future JWT authentication support

### 2. PhoenixStore Core
- Implements Firestore-like document/collection pattern
- Type-safe operations with TypeScript
- Handles data validation and transformation
- Manages database connections and pooling

### 3. MongoDB Adapter
- Abstracts MongoDB operations
- Handles connection management
- Implements retry logic and error handling
- Converts between Firestore and MongoDB query patterns

### 4. Supporting Services
- **Mongo Express**: Web-based MongoDB admin interface
- **Docker Compose**: Orchestrates all services
- **Environment Management**: `.env` file for configuration

## Data Flow

1. **Request Flow**
   ```mermaid
   sequenceDiagram
       Client->>+API: HTTP Request
       API->>+Core: Process Request
       Core->>+Adapter: Database Operation
       Adapter->>+MongoDB: Execute Query
       MongoDB-->>-Adapter: Return Results
       Adapter-->>-Core: Transform Data
       Core-->>-API: Format Response
       API-->>-Client: HTTP Response
   ```

2. **Error Handling Flow**
   ```mermaid
   sequenceDiagram
       participant C as Client
       participant A as API
       participant M as MongoDB
       
       C->>A: Request
       activate A
       A->>M: Query
       activate M
       alt Success
           M-->>A: Data
           A-->>C: 200 OK
       else Database Error
           M-->>A: Error
           A-->>C: Error Response
       else Invalid Request
           A-->>C: Validation Error
       end
       deactivate M
       deactivate A
   ```

## Design Decisions

### 1. Why MongoDB?
- Document-based structure similar to Firestore
- Excellent performance characteristics
- Rich query capabilities
- Strong community support
- Easy scaling options

### 2. Why Elysia.js?
- Built-in TypeScript support
- High performance
- Built-in Swagger support
- Simple middleware system
- WebSocket capabilities for future features

### 3. Why Docker?
- Consistent development environment
- Easy service orchestration
- Simple scaling
- Isolated testing environment

## Security Considerations

1. **Authentication**
   - JWT-based authentication (planned)
   - Role-based access control
   - Secure token storage

2. **Data Security**
   - Input validation
   - Query sanitization
   - Error message sanitization

3. **Infrastructure**
   - Container isolation
   - Environment variable management
   - Network security

## Performance Considerations

1. **Connection Pooling**
   - MongoDB connection pool management
   - Connection reuse
   - Proper error handling

2. **Caching Strategy**
   - Future implementation of caching layer
   - Query result caching
   - Document caching

3. **Query Optimization**
   - Index management
   - Query monitoring
   - Performance logging

## Future Architecture Extensions

1. **Real-time Updates**
   - WebSocket integration
   - Change streams
   - Client-side caching

2. **Scaling**
   - Horizontal scaling
   - Load balancing
   - Sharding strategy

3. **Monitoring**
   - Performance metrics
   - Error tracking
   - Usage analytics

## Future Stretch Goals

1. **Firebase Cloud Functions Alternative**
   - Serverless function execution
   - Event-driven triggers (document changes, auth events)
   - HTTP triggers
   - Scheduled functions
   - Background tasks
   - Function deployment and versioning

2. **Native Bun WebSockets**
   - Replace ws library with Bun's native WebSocket implementation
   - Performance optimization
   - Reduced dependencies
   - Better integration with Bun runtime

3. **Advanced Features**
   // ... existing code ... 