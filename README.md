# SFE - PhoenixStore: A Drop-in Firestore Replacement

A MongoDB-based Firestore alternative with familiar syntax for Flutter/Web projects. Built with Bun for performance and developer experience.

## Core Philosophy

SFE - PhoenixStore aims to provide a self-hosted alternative to Firebase/Firestore while maintaining familiar syntax and patterns. This allows teams to:
- Migrate away from Firebase without rewriting application logic
- Maintain ownership of data and infrastructure
- Scale costs predictably
- Keep the developer experience consistent

## Tech Stack

### Backend
- **Bun**: Fast JavaScript runtime with native TypeScript support
- **MongoDB**: Document database with similar structure to Firestore
- **SFE - PhoenixStore**: Our custom wrapper providing Firestore-like syntax

### Infrastructure
- **Docker**: Containerization for consistent deployment
- **MongoDB Express**: Database management UI for development
- **Nginx**: (Optional) Reverse proxy for production

## Getting Started

```bash
# Clone the template
git clone https://github.com/your-org/sfe-phoenixstore-template

# Install dependencies
bun install

# Start development environment
docker-compose up -d
```

## Architecture

### Docker Services
```yaml
version: '3.8'
services:
  backend:
    build: ./backend
    environment:
      - MONGODB_URL=mongodb://mongodb:27017/app
    ports:
      - "3000:3000"

  mongodb:
    image: mongo:latest
    volumes:
      - mongodb_data:/data/db

  mongo-express:
    image: mongo-express
    ports:
      - "8081:8081"
    environment:
      - ME_CONFIG_MONGODB_SERVER=mongodb

volumes:
  mongodb_data:
```

### PhoenixStore API

```typescript
// Initialize
const db = new PhoenixStore('mongodb://localhost:27017', 'myapp');
await db.connect();

// CRUD Operations
// Create
const doc = await db.collection('users').add({
  name: 'John',
  age: 30
});

// Read
const user = await db.collection('users').doc('123').get();

// Update
await db.collection('users').doc('123').update({
  age: 31
});

// Delete
await db.collection('users').doc('123').delete();

// Queries
const results = await db.collection('users')
  .where('age', '>', 21)
  .orderBy('name', 'asc')
  .limit(10)
  .get();
```

## Migration Guide

### From Firestore
1. Update connection details in your app
2. Replace Firebase imports with PhoenixStore
3. Update environment variables
4. Run migration script (provided)

```typescript
// Before (Firestore)
import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';

// After (PhoenixStore)
import { SFEPhoenixStore } from '@your-org/sfe-phoenixstore';
```

## Development Guidelines

### Adding New Features
1. Match Firestore's API syntax where possible
2. Add MongoDB implementation in wrapper
3. Add tests
4. Update documentation

### Testing
```bash
# Run test suite
bun test

# Run specific tests
bun test --spec Auth
```

## TODO

### Phase 1: Core Implementation
- [ ] Basic CRUD operations
- [ ] Query operations (where, orderBy, limit)
- [ ] Authentication wrapper
- [ ] Basic error handling

### Phase 2: Advanced Features
- [ ] Real-time updates using MongoDB Change Streams
- [ ] Batch operations
- [ ] Transactions
- [ ] Advanced querying (array operations, etc.)

### Phase 3: Production Readiness
- [ ] Performance optimization
- [ ] Connection pooling
- [ ] Monitoring and logging
- [ ] Production deployment guide

### Phase 4: Additional Features
- [ ] Offline support
- [ ] Data validation
- [ ] Migration tools
- [ ] CLI tools

## Making It Project Agnostic

PhoenixStore is designed to be project-agnostic through:

1. Configuration
```typescript
// config.ts
export interface PhoenixStoreConfig {
  mongodb: {
    uri: string;
    dbName: string;
    options?: MongoClientOptions;
  };
  collections?: {
    prefix?: string;
    whitelist?: string[];
  };
  auth?: {
    enabled: boolean;
    provider?: 'jwt' | 'custom';
  };
}
```

2. Middleware Support
```typescript
// Add custom middleware
db.use(async (ctx, next) => {
  // Custom logic
  await next();
});
```

3. Plugin System (TODO)
```typescript
// Add functionality without modifying core
db.plugin('myFeature', {
  // Plugin configuration
});
```

## Why These Choices?

### MongoDB
- Document-based like Firestore
- Mature, well-supported
- Rich query capabilities
- Change streams for real-time updates
- Good performance at scale

### Bun
- Fast startup and execution
- Native TypeScript support
- Built-in testing
- Modern JavaScript features
- Growing ecosystem

### Docker
- Consistent development environment
- Easy deployment
- Scalable architecture
- Simple local development

## Contributing

1. Fork the repository
2. Create a feature branch
3. Submit a pull request

See CONTRIBUTING.md for detailed guidelines.

## License

TBD