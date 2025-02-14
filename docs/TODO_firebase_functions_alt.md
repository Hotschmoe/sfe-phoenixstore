# Firebase Functions Alternative Implementation Plan

## Overview
This document outlines three potential approaches for implementing Firebase Cloud Functions-like functionality in PhoenixStore, along with their respective trade-offs and a final recommendation.

## Implementation Approaches

### Approach 1: Functions Directory Within Main Repo
This approach integrates the functions runtime directly into the main PhoenixStore repository.

#### Structure
```
phoenixstore/
├── src/
│   ├── functions/
│   │   ├── engine/
│   │   │   ├── triggers.ts        # Event trigger system
│   │   │   ├── context.ts         # Function context & auth
│   │   │   ├── loader.ts          # Hot-reload function files
│   │   │   └── scheduler.ts       # Cron job scheduler
│   │   ├── templates/             # Example function templates
│   │   └── types/                 # Type definitions
│   └── ... (existing files)
└── functions/                     # User's function directory
    ├── http/
    │   ├── api.ts
    │   └── webhooks.ts
    ├── database/
    │   ├── users/
    │   │   ├── onCreate.ts
    │   │   └── onUpdate.ts
    │   └── orders/
    │       └── onPaymentComplete.ts
    └── scheduled/
        └── dailyCleanup.ts
```

#### Advantages
- Tight integration with PhoenixStore core
- Shared types and utilities
- Simpler deployment (single repository)
- Easier testing setup
- Shared configuration

#### Disadvantages
- Less separation of concerns
- May make the main repo more complex
- All functions deploy together

#### Example Implementation
```typescript
// functions/database/users/onCreate.ts
import { onDocumentCreated } from 'phoenixstore/functions';

export const createUserProfile = onDocumentCreated('users', async (event, context) => {
  const { data } = event;
  
  // Create user profile
  await context.db.collection('profiles').add({
    userId: data.id,
    createdAt: context.timestamp,
    status: 'active'
  });
  
  // Send welcome email
  await context.services.email.send({
    to: data.email,
    template: 'welcome'
  });
});

// functions/http/api.ts
import { onRequest } from 'phoenixstore/functions';

export const api = onRequest('/api/v1/custom', async (req, res) => {
  const { method, body } = req;
  
  switch (method) {
    case 'GET':
      // Handle GET request
      break;
    case 'POST':
      // Handle POST request
      break;
    default:
      res.status(405).json({ error: 'Method not allowed' });
  }
});

// functions/scheduled/dailyCleanup.ts
import { onSchedule } from 'phoenixstore/functions';

export const cleanup = onSchedule('0 0 * * *', async (context) => {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  
  await context.db.collection('logs')
    .where('timestamp', '<', thirtyDaysAgo)
    .delete();
});
```

### Approach 2: Separate Functions Repository
This approach maintains functions in a completely separate repository.

#### Structure
```
phoenixstore-functions/
├── src/
│   ├── functions/
│   │   ├── http/
│   │   ├── database/
│   │   └── scheduled/
│   ├── config/
│   ├── types/
│   └── utils/
├── tests/
└── package.json
```

#### Advantages
- Clear separation of concerns
- Independent versioning
- Can be maintained by different teams
- Selective function deployment
- Independent scaling

#### Disadvantages
- More complex setup
- Duplicate configuration
- Need to sync PhoenixStore SDK versions
- More complex local development
- Separate deployment pipelines

### Approach 3: Microservices Architecture
This approach breaks down functions into separate microservices.

#### Structure
```
phoenixstore-services/
├── auth-service/
├── email-service/
├── payment-service/
└── notification-service/
```

#### Advantages
- Maximum flexibility
- Independent scaling
- Technology agnostic
- Clear service boundaries
- Easy to maintain and deploy

#### Disadvantages
- Most complex setup
- Higher operational overhead
- More infrastructure needed
- Complex local development
- Higher latency between services

## Recommended Approach: Functions Directory Within Main Repo

We recommend implementing Approach 1 (Functions Directory Within Main Repo) for the following reasons:

1. **Developer Experience**
   - Similar to Firebase Functions (familiar to target audience)
   - Simple local development setup
   - Hot reloading support
   - Integrated debugging
   - Single codebase to manage

2. **Implementation Plan**

   Phase 1: Core Infrastructure
   ```typescript
   // src/functions/engine/context.ts
   export interface FunctionContext {
     db: PhoenixStore;
     auth: {
       uid?: string;
       token?: string;
     };
     timestamp: Date;
     services: {
       email: EmailService;
       storage: StorageService;
       // Add more services as needed
     };
   }
   ```

   Phase 2: Event System
   ```typescript
   // src/functions/engine/triggers.ts
   export class EventSystem {
     private handlers: Map<string, Function[]> = new Map();
     
     on(event: string, handler: Function) {
       const existing = this.handlers.get(event) || [];
       this.handlers.set(event, [...existing, handler]);
     }
     
     async emit(event: string, data: any) {
       const handlers = this.handlers.get(event) || [];
       await Promise.all(handlers.map(h => h(data)));
     }
   }
   ```

   Phase 3: Function Types
   ```typescript
   // src/functions/types/index.ts
   export type HttpFunction = (req: Request, res: Response) => Promise<void>;
   export type DatabaseFunction = (event: DatabaseEvent, context: FunctionContext) => Promise<void>;
   export type ScheduledFunction = (context: FunctionContext) => Promise<void>;
   ```

3. **Development Workflow**
   ```bash
   # Start function development server
   bun run dev:functions

   # Deploy functions
   bun run deploy:functions

   # Run function tests
   bun test functions/
   ```

4. **Configuration**
   ```typescript
   // src/functions/config.ts
   export interface FunctionsConfig {
     runtime: {
       maxTimeout: number;
       memory: string;
       region: string;
     };
     scaling: {
       minInstances: number;
       maxInstances: number;
     };
     triggers: {
       http: boolean;
       database: boolean;
       scheduled: boolean;
     };
   }
   ```

5. **Security**
   ```typescript
   // Function-level security
   export const adminOnly = onRequest('/admin/api', async (req, res, context) => {
     if (!context.auth?.isAdmin) {
       return res.status(403).json({ error: 'Admin only' });
     }
     // Function logic
   });
   ```

6. **Monitoring and Logging**
   ```typescript
   // src/functions/engine/logger.ts
   export class FunctionLogger {
     log(level: 'info' | 'error', message: string, data?: any) {
       // Implementation
     }
     
     metric(name: string, value: number, labels?: Record<string, string>) {
       // Implementation
     }
   }
   ```

## Implementation Timeline

1. **Week 1-2: Core Infrastructure**
   - Set up function runtime
   - Implement context system
   - Basic HTTP functions

2. **Week 3-4: Event System**
   - Database triggers
   - Event emitter
   - Function registry

3. **Week 5-6: Developer Experience**
   - Hot reloading
   - Development server
   - Function templates

4. **Week 7-8: Advanced Features**
   - Scheduled functions
   - Monitoring
   - Deployment tooling

## Future Considerations

1. **Scaling**
   - Function instance scaling
   - Cold start optimization
   - Memory management

2. **Feature Additions**
   - WebSocket functions
   - Queue processing
   - Stream processing
   - External triggers

3. **Monitoring**
   - Function metrics
   - Performance tracking
   - Cost analysis
   - Error reporting

4. **Developer Tools**
   - CLI tools
   - VS Code extension
   - Function debugger
   - Local emulator

## Migration Strategy

For users moving from Firebase Functions:

```typescript
// Firebase Functions
exports.createUser = functions.auth.user().onCreate((user) => {
  // Logic
});

// PhoenixStore Functions
export const createUser = onUserCreated(async (user, context) => {
  // Similar logic
});
```

## Conclusion

The Functions Directory Within Main Repo approach provides the best balance of developer experience, maintainability, and functionality for the PhoenixStore ecosystem. It allows for gradual implementation and feature addition while maintaining similarity with Firebase Functions for easier adoption.

This approach can be evolved into a more distributed system in the future if needed, but starting with an integrated approach will allow faster development and easier maintenance in the early stages of the project.




---> Can we add functions info automatically to swagger?