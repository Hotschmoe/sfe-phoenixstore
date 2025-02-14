# Authentication & File Storage Implementation TODOs

## Part 1: Authentication & Security Implementation

### Phase 1: Basic JWT Setup
- [ ] Install required dependencies
  ```bash
  bun add jsonwebtoken bcryptjs
  bun add -d @types/jsonwebtoken @types/bcryptjs
  ```

- [ ] Create auth-related types in `src/types/auth.ts`
  ```typescript
  interface UserCredentials {
    email: string;
    password: string;
  }
  
  interface JWTPayload {
    uid: string;
    email: string;
    role: string;
  }
  ```

- [ ] Set up JWT utilities in `src/utils/jwt.ts`
  - [ ] Implement token generation
  - [ ] Implement token verification
  - [ ] Add token refresh logic

### Phase 2: User Management
- [ ] Create User collection schema in `src/types/user.ts`
  - [ ] Define user properties (email, password hash, etc.)
  - [ ] Add role-based access control types

- [ ] Implement user management in `src/core/UserManager.ts`
  - [ ] User registration
  - [ ] Password hashing
  - [ ] User lookup
  - [ ] Password validation

### Phase 3: Auth Middleware
- [ ] Create auth middleware in `src/api/middleware/auth.ts`
  - [ ] JWT verification middleware
  - [ ] Role checking middleware
  - [ ] Error handling for auth failures

### Phase 4: Auth Routes
- [ ] Add auth routes in `src/api/routes/auth.ts`
  - [ ] POST /auth/register
  - [ ] POST /auth/login
  - [ ] POST /auth/refresh
  - [ ] POST /auth/logout

### Phase 5: Integration
- [ ] Update PhoenixApi class to use auth middleware
- [ ] Add authentication to existing routes
- [ ] Update Swagger documentation
- [ ] Add auth context to PhoenixStore

### Phase 6: Testing
- [ ] Write tests for JWT utilities
- [ ] Write tests for user management
- [ ] Write tests for auth routes
- [ ] Add auth integration tests

### Phase 7: Documentation
- [ ] Update API documentation with auth info
- [ ] Add authentication examples to README
- [ ] Document security best practices

## Part 2: File Storage Integration (MinIO)

### Phase 1: MinIO Setup
- [ ] Add MinIO service to docker-compose.yml
  ```yaml
  minio:
    image: minio/minio
    ports:
      - "9000:9000"
      - "9001:9001"
    environment:
      MINIO_ROOT_USER: minioadmin
      MINIO_ROOT_PASSWORD: minioadmin
    command: server --console-address ":9001" /data
    volumes:
      - minio_data:/data
  ```

- [ ] Install MinIO client dependencies
  ```bash
  bun add minio
  ```

### Phase 2: Storage Core
- [ ] Create storage types in `src/types/storage.ts`
  ```typescript
  interface FileMetadata {
    filename: string;
    size: number;
    mimetype: string;
    bucket: string;
    path: string;
  }
  ```

- [ ] Implement StorageAdapter in `src/adapters/StorageAdapter.ts`
  - [ ] Connection management
  - [ ] File upload
  - [ ] File download
  - [ ] File deletion
  - [ ] Bucket management

### Phase 3: Storage API
- [ ] Add storage routes in `src/api/routes/storage.ts`
  - [ ] POST /storage/upload
  - [ ] GET /storage/download/:id
  - [ ] DELETE /storage/files/:id
  - [ ] GET /storage/files (list)

### Phase 4: File Management
- [ ] Create FileManager in `src/core/FileManager.ts`
  - [ ] File metadata tracking
  - [ ] Access control
  - [ ] File validation
  - [ ] Cleanup routines

### Phase 5: Integration
- [ ] Add storage context to PhoenixStore
- [ ] Update API documentation
- [ ] Add file upload examples

### Phase 6: Testing
- [ ] Write tests for StorageAdapter
- [ ] Write tests for FileManager
- [ ] Write tests for storage routes
- [ ] Add storage integration tests

### Phase 7: Security & Optimization
- [ ] Implement file type validation
- [ ] Add virus scanning (ClamAV)
- [ ] Set up file size limits
- [ ] Configure bucket policies

### Phase 8: Documentation
- [ ] Update API documentation
- [ ] Add storage examples to README
- [ ] Document file handling best practices

## Implementation Order

1. Start with Authentication:
   - Complete Auth Phases 1-4 first
   - These provide the security foundation
   - Test thoroughly before moving on

2. Then implement Storage:
   - Complete Storage Phases 1-3
   - Integrate with the auth system
   - Add remaining features

## Development Tips

### Authentication
1. Test JWT tokens with https://jwt.io
2. Use strong password hashing (bcrypt)
3. Implement rate limiting for auth routes
4. Use environment variables for secrets

### File Storage
1. Start with small file uploads first
2. Test with various file types
3. Implement proper error handling
4. Consider implementing file chunking for large files

## Testing Checklist

### Auth Testing
- [ ] Test token generation/validation
- [ ] Test password hashing
- [ ] Test all auth routes
- [ ] Test invalid credentials
- [ ] Test token expiration
- [ ] Test role-based access

### Storage Testing
- [ ] Test file upload/download
- [ ] Test large files
- [ ] Test concurrent uploads
- [ ] Test invalid files
- [ ] Test access control
- [ ] Test bucket operations

## Security Checklist

### Authentication
- [ ] Use HTTPS in production
- [ ] Implement rate limiting
- [ ] Use secure password hashing
- [ ] Implement token refresh
- [ ] Add request validation
- [ ] Log security events

### File Storage
- [ ] Validate file types
- [ ] Scan for malware
- [ ] Set file size limits
- [ ] Use signed URLs
- [ ] Implement access control
- [ ] Back up file metadata

Remember:
- Commit often with meaningful messages
- Write tests for new features
- Update documentation as you go
- Ask for help if stuck
- Consider security implications
