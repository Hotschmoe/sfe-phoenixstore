# PhoenixStore REST API and SDK Development Plan

## Current Status
PhoenixStore currently has basic CRUD operations implemented as direct database utilities using MongoDB. We've decided to split development into two main tracks:

1. Core PhoenixStore with REST API (This Repository)
2. Flutter SDK (New Repository: phoenixstore-flutter-sdk)

## Architecture Decision
We're implementing both a REST API and SDK approach because:
- REST API provides universal access and easier debugging
- Flutter SDK will provide familiar Firestore-like syntax for easy adoption
- This approach allows for future SDK development in other languages

## Technology Choices

### Core Server (This Repo)
- Bun as runtime
- Elysia as web framework
  - Built-in TypeScript support
  - Great performance
  - WebSocket support for future features
  - Good middleware system
- MongoDB for database
- Docker for deployment

### Flutter SDK (New Repo)
- Dart/Flutter
- Will be distributed via GitHub initially
- Can be imported directly in pubspec.yaml
- Future publication to pub.dev when mature

## Development Plan

### Phase 1: REST API Development (2-3 weeks)
1. **Setup Elysia Framework (Day 1-2)** ✅
   - Install and configure Elysia
   - Set up project structure
   - Configure TypeScript

2. **Core REST Endpoints (Week 1)** ✅
   - Implement CRUD operations
   - Document endpoints
   - Add request validation
   - Add error handling
   ```
   POST   /api/v1/{collection}          # Create document
   GET    /api/v1/{collection}/{id}     # Read document
   PUT    /api/v1/{collection}/{id}     # Update document
   DELETE /api/v1/{collection}/{id}     # Delete document
   ```

3. **Query Operations (Week 2)** ✅
   - Implement where clauses with operators:
     - Basic operators: ==, !=, >, >=, <, <=
     - Array operators: array-contains, array-contains-any
     - Collection operators: in, not-in
   - Add orderBy functionality (asc/desc)
   - Add limit/offset pagination
   - Add collection queries
   - Comprehensive test coverage
   ```
   GET /api/v1/{collection}?where=field:op:value&orderBy=field:direction&limit=10
   ```

4. **Authentication (Week 2-3)** 🚧
   - Implement basic auth system
   - Add JWT support
   - Add middleware for auth checks
   - Document auth flow

### Phase 2: Flutter SDK Development (Parallel Track)
Can be started in parallel by Flutter developer:

1. **Basic Setup**
   - Create new repository
   - Set up Dart project structure
   - Add HTTP client dependencies

2. **Core SDK Features**
   - Implement Firestore-like syntax
   - Add CRUD operations
   - Add query builder
   - Add error handling

3. **Authentication**
   - Implement auth methods
   - Add token management
   - Add user session handling

### Phase 3: Integration and Testing (1-2 weeks)
1. **Testing**
   - Add integration tests
   - Test cross-platform functionality
   - Performance testing
   - Load testing

2. **Documentation**
   - API documentation
   - SDK usage guide
   - Example implementations
   - Deployment guide

### Phase 4: MVP Features (1-2 weeks)
1. **Core Features**
   - Collection queries
   - Basic security rules
   - Error handling
   - Rate limiting

2. **Developer Experience**
   - Logging
   - Debugging tools
   - Migration guides
   - Example projects

## Future Phases (Post-MVP)

### Phase 5: Real-time Updates
- WebSocket implementation
- Real-time subscriptions
- Connection management
- Offline support

### Phase 6: Advanced Features
- Batch operations
- Transactions
- Complex queries
- Advanced security rules

## Distribution Strategy

### Core Server
- Docker image
- Documentation for self-hosting
- Example deployment configs

### Flutter SDK
1. **Initial Distribution**
   - GitHub repository
   - Direct installation via pubspec.yaml
   ```yaml
   dependencies:
     phoenixstore:
       git:
         url: https://github.com/yourusername/phoenixstore-flutter
         ref: main
   ```

2. **Future Distribution**
   - Publish to pub.dev
   - Version management
   - Changelog maintenance

## Next Immediate Steps

1. **REST API Setup (This Week)**
   - Set up Elysia in current project
   - Create initial endpoint structure
   - Convert existing CRUD operations to REST endpoints
   - Add basic error handling
   - Document API structure

2. **Flutter SDK (Parallel)**
   - Create new repository
   - Set up basic project structure
   - Implement HTTP client
   - Create Firestore-like interface

3. **Integration (Next Week)**
   - Test API with basic SDK implementation
   - Document any issues or needed changes
   - Create example project

## Development Guidelines

1. **API Design**
   - RESTful principles
   - Consistent error formats
   - Clear status codes
   - Comprehensive documentation

2. **SDK Design**
   - Match Firestore syntax
   - Strong typing
   - Clear error messages
   - Easy authentication

3. **Testing**
   - Unit tests for all features
   - Integration tests
   - Example implementations
   - Performance benchmarks

## Notes
- Focus on getting basic CRUD and queries working first
- Prioritize developer experience
- Keep documentation up to date
- Regular communication between REST API and SDK teams
- Weekly progress reviews
- Flexible planning for requirement changes

Remember: The goal is a working MVP that can replace Firestore for basic operations. Advanced features can be added iteratively based on user feedback and needs.