# PhoenixStore Developer Guide

## Core Development Principles

1. **Project Agnosticism**
   - All features must be configurable and optional
   - No hard dependencies on specific frameworks
   - Abstract implementation details where possible
   ```typescript
   // Good ✅
   export interface PhoenixConfig {
     features: {
       realtime?: boolean;
       authentication?: AuthConfig;
       caching?: CacheConfig;
     }
   }

   // Bad ❌
   const db = new PhoenixStore({
     mustUseAuth: true,  // Forces feature
     nextAuth: authConfig  // Framework specific
   });
   ```

2. **TypeScript First**
   - All code must be written in TypeScript
   - Maintain strict type checking
   - Export type definitions
   ```typescript
   // Good ✅
   export interface QueryOptions<T> {
     limit?: number;
     orderBy?: keyof T;
     direction?: 'asc' | 'desc';
   }

   // Bad ❌
   function query(options: any) {
     // Untyped implementation
   }
   ```

## Testing Standards

1. **Test Structure**
   ```typescript
   // Each feature should have:
   - unit.test.ts      // Unit tests
   - integration.test.ts // Integration tests with MongoDB
   - e2e.test.ts       // End-to-end with full stack
   ```

2. **Test Coverage Requirements**
   - Minimum 85% coverage for new code
   - 100% coverage for core database operations
   - All edge cases must be tested

3. **Running Tests**
   ```bash
   # Unit tests
   bun test

   # Integration tests (requires MongoDB)
   bun test:integration

   # Coverage report
   bun test:coverage
   ```

## MongoDB Best Practices

1. **Connection Management**
   ```typescript
   // Good ✅
   class PhoenixStore {
     private static instance: MongoClient;
     
     static async connect(uri: string) {
       if (!this.instance) {
         this.instance = await MongoClient.connect(uri, {
           maxPoolSize: 10,
           minPoolSize: 1,
           retryWrites: true
         });
       }
       return this.instance;
     }
   }
   ```

2. **Indexing**
   - Document all required indexes
   - Provide index creation scripts
   - Monitor index usage

3. **Query Optimization**
   ```typescript
   // Good ✅
   const result = await collection
     .find({ status: 'active' })
     .project({ name: 1, email: 1 })
     .limit(10)
     .toArray();

   // Bad ❌
   const result = await collection
     .find({})
     .toArray();
   // Filtering in memory
   ```

## Docker Development

1. **Local Development**
   ```yaml
   # docker-compose.dev.yml
   version: '3.8'
   services:
     phoenixstore:
       build:
         context: .
         target: development
       volumes:
         - .:/app
       command: bun run dev

     mongodb:
       image: mongo:latest
       ports:
         - "27017:27017"
   ```

2. **Production Build**
   ```dockerfile
   # Dockerfile
   FROM oven/bun:latest as builder
   WORKDIR /app
   COPY package.json .
   COPY bun.lockb .
   RUN bun install --frozen-lockfile
   COPY . .
   RUN bun run build

   FROM oven/bun:latest
   WORKDIR /app
   COPY --from=builder /app/dist ./dist
   CMD ["bun", "run", "start"]
   ```

## Code Style Guide

1. **File Structure**
   ```
   src/
   ├── core/           # Core PhoenixStore functionality
   ├── adapters/       # Database adapters
   ├── utils/          # Shared utilities
   ├── types/          # TypeScript types
   └── plugins/        # Optional plugins
   ```

2. **Naming Conventions**
   ```typescript
   // Classes: PascalCase
   class QueryBuilder {}

   // Interfaces: PascalCase with 'I' prefix
   interface IQueryOptions {}

   // Files: kebab-case
   // query-builder.ts
   ```

3. **Error Handling**
   ```typescript
   // Custom error classes
   export class PhoenixError extends Error {
     constructor(message: string, public code: string) {
       super(message);
     }
   }

   // Usage
   throw new PhoenixError('Document not found', 'PHOENIX_NOT_FOUND');
   ```

## Documentation Requirements

1. **Code Documentation**
   ```typescript
   /**
    * Queries the collection with Firestore-like syntax
    * @param field - The field to query
    * @param operator - Comparison operator
    * @param value - Value to compare against
    * @returns QueryBuilder instance
    * @throws {PhoenixError} If operator is invalid
    */
   where(field: string, operator: string, value: any): QueryBuilder
   ```

2. **README Updates**
   - All new features must be documented
   - Include code examples
   - Update migration guide if needed

## Performance Guidelines

1. **Benchmarks**
   - Must maintain or improve existing performance
   - New features must include benchmark tests
   ```typescript
   // benchmark.ts
   import { benchmark } from 'bun:bench';

   await benchmark('Query Performance', async () => {
     // Test implementation
   });
   ```

2. **Memory Management**
   - Monitor memory usage
   - Implement proper cleanup
   - Use connection pooling

## Publishing

1. **Version Control**
   ```bash
   # Bump version
   bun run version:bump

   # Build
   bun run build

   # Publish
   bun run publish
   ```

2. **Changelog**
   - Follow semantic versioning
   - Document all changes
   - Include migration steps

## Security

1. **Code Security**
   - No sensitive data in logs
   - Sanitize all inputs
   - Use parameterized queries

2. **Authentication**
   - Support multiple auth providers
   - Follow OAuth best practices
   - Document security features

## Contributing

1. **Pull Request Process**
   - Create feature branch
   - Add tests
   - Update documentation
   - Get code review
   - Pass CI/CD checks

2. **Commit Messages**
   ```
   feat: add new query operator
   fix: resolve connection pooling issue
   docs: update authentication guide
   test: add edge case tests
   ```

Remember: PhoenixStore aims to be a professional-grade Firestore alternative. All contributions should maintain this standard while keeping the codebase accessible to new contributors.