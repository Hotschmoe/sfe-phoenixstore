# Contributing to PhoenixStore

## Getting Started

### Prerequisites

- [Bun](https://bun.sh/) (v1.0.0 or higher)
- [Docker](https://www.docker.com/) and Docker Compose
- [Git](https://git-scm.com/)
- A code editor (we recommend VS Code)

### Development Environment Setup

1. **Clone the Repository**
   ```bash
   git clone https://github.com/yourusername/phoenixstore.git
   cd phoenixstore
   ```

2. **Install Dependencies**
   ```bash
   bun install
   ```

3. **Environment Configuration**
   ```bash
   cp .env.example .env
   # Edit .env with your settings
   ```

4. **Start Development Services**
   ```bash
   docker-compose up -d
   ```

5. **Run Tests**
   ```bash
   bun test
   ```

## Project Structure

```
phoenixstore/
├── docs/               # Documentation
├── src/               # Source code
│   ├── adapters/      # Database adapters
│   ├── api/           # REST API implementation
│   ├── core/          # Core functionality
│   ├── tests/         # Test files
│   ├── types/         # TypeScript types
│   └── utils/         # Utility functions
├── docker-compose.yml # Docker configuration
├── Dockerfile        # Docker build file
└── package.json      # Project configuration
```

## Development Guidelines

### 1. Code Style

- Use TypeScript for all new code
- Follow the existing code style
- Use meaningful variable and function names
- Document complex logic with comments
- Keep functions small and focused

### 2. TypeScript Best Practices

```typescript
// Good ✅
interface UserData {
  id: string;
  name: string;
  email: string;
}

async function getUser(id: string): Promise<UserData | null> {
  // Implementation
}

// Bad ❌
function getUser(id: any): any {
  // Implementation
}
```

### 3. Testing Requirements

- Write tests for all new features
- Maintain test coverage above 85%
- Test edge cases and error conditions
- Use meaningful test descriptions

```typescript
describe("UserService", () => {
  test("should handle invalid email formats", async () => {
    const result = await service.validateEmail("invalid-email");
    expect(result.isValid).toBe(false);
    expect(result.error).toBe("INVALID_EMAIL_FORMAT");
  });
});
```

### 4. Git Workflow

1. **Branch Naming**
   ```
   feature/add-user-authentication
   fix/connection-timeout
   docs/update-api-docs
   ```

2. **Commit Messages**
   ```
   feat: add user authentication
   fix: resolve connection timeout issues
   docs: update API documentation
   test: add tests for user service
   ```

3. **Pull Request Process**
   - Create a feature branch
   - Write tests
   - Update documentation
   - Submit PR with description
   - Address review comments

### 5. Documentation

- Update relevant documentation for new features
- Include JSDoc comments for public APIs
- Add examples for complex functionality
- Keep README up to date

```typescript
/**
 * Creates a new user in the database
 * @param userData - The user data to create
 * @returns The created user's ID
 * @throws {ValidationError} If user data is invalid
 */
async function createUser(userData: UserData): Promise<string> {
  // Implementation
}
```

## Testing Guide

### 1. Running Tests

```bash
# Run all tests
bun test

# Run specific test file
bun test src/tests/specific.test.ts

# Run tests in watch mode
bun test --watch

# Generate coverage report
bun test --coverage
```

### 2. Writing Tests

```typescript
import { expect, test, describe } from "bun:test";

describe("Feature", () => {
  test("should handle normal case", async () => {
    // Arrange
    const input = {};
    
    // Act
    const result = await someFunction(input);
    
    // Assert
    expect(result).toBeDefined();
  });

  test("should handle error case", async () => {
    // Test implementation
  });
});
```

### 3. Test Environment

- Tests run against a separate test database
- Docker services must be running
- Environment is cleaned between test suites
- Use unique collection names in tests

## Debugging

### 1. Local Development

```bash
# Start services
docker-compose up -d

# Watch mode
bun run dev

# Check logs
docker-compose logs -f

# Access MongoDB Express
open http://localhost:8081
```

### 2. Common Issues

1. **MongoDB Connection**
   ```bash
   # Check MongoDB status
   docker-compose ps
   
   # Restart services
   docker-compose restart
   ```

2. **Test Failures**
   - Ensure Docker is running
   - Check MongoDB connection
   - Verify test database cleanup

## Performance Guidelines

1. **Database Operations**
   - Use indexes appropriately
   - Implement pagination
   - Monitor query performance

2. **API Endpoints**
   - Validate input data
   - Handle errors gracefully
   - Use appropriate HTTP status codes

## Security Guidelines

1. **Data Validation**
   - Sanitize user input
   - Validate data types
   - Check permissions

2. **Error Handling**
   - Don't expose internal errors
   - Log security events
   - Implement rate limiting

## Release Process

### Version Numbering

PhoenixStore uses semantic versioning with a focus on Firestore SDK compatibility:

```
x.y.z format where:

x (major) - Firestore SDK Compatibility
- Increment when breaking Firestore SDK compatibility
- Projects using Firestore SDK vX should work with PhoenixStore vX
- Major architectural changes also increment this

y (minor) - Feature Updates
- New features that maintain compatibility
- Significant improvements
- Non-breaking API changes

z (patch) - Bug Fixes
- Bug fixes
- Performance improvements
- Documentation updates
```

Examples:
- `1.0.0`: Initial release, compatible with Firestore SDK v1
- `1.1.0`: Added new features, still compatible with Firestore SDK v1
- `1.1.1`: Bug fixes for v1.1.0
- `2.0.0`: Breaking changes, now compatible with Firestore SDK v2

### Version Update Guidelines

1. **Major Version (x)**
   - Requires extensive testing with target Firestore SDK version
   - Must include migration guide in documentation
   - Requires sign-off from core maintainers

2. **Minor Version (y)**
   - Feature additions must be backward compatible
   - Update API documentation
   - Include examples for new features

3. **Patch Version (z)**
   - No breaking changes
   - Must include test cases for fixed bugs
   - Update changelog with fix details

### Release Steps

1. **Preparation**
   - Update version number
   - Update CHANGELOG.md
   - Run full test suite

2. **Release Steps**
   ```bash
   # Update version based on changes
   bun version major  # For x.0.0
   bun version minor  # For 0.y.0
   bun version patch  # For 0.0.z
   
   # Build
   bun run build
   
   # Create release
   git tag vX.Y.Z
   git push origin vX.Y.Z
   ```

## Getting Help

- Check existing issues
- Join our Discord community
- Review documentation
- Ask in discussions

Remember: PhoenixStore aims to be a professional-grade Firestore alternative. All contributions should maintain this standard while keeping the codebase accessible to new contributors. 