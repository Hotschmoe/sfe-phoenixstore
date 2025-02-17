# SFE - PhoenixStore 🔥

A MongoDB-based Firestore alternative with familiar syntax for Flutter/Web projects.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Build Status](https://github.com/yourusername/phoenixstore/workflows/CI/badge.svg)](https://github.com/yourusername/phoenixstore/actions)
[![npm version](https://badge.fury.io/js/phoenixstore.svg)](https://badge.fury.io/js/phoenixstore)

## Why PhoenixStore?

- 🚀 **Firestore-like API**: Familiar syntax for Firebase/Firestore developers
- 📦 **MongoDB Backend**: Powerful, scalable document database
- 🛠️ **Self-hosted**: Full control over your data and infrastructure
- 🔒 **Type-safe**: Built with TypeScript for robust development
- 🌐 **REST API**: Easy integration with any platform
- 📱 **Flutter SDK**: Native Flutter integration (coming soon)

## Quick Start

### 1. Installation 

```bash
# Using bun
bun add phoenixstore

# Using npm
npm install phoenixstore

# Using yarn
yarn add phoenixstore
```

1.a PowerShell Command for Docker Compose

```powershell
docker compose down; docker compose build --no-cache; docker compose up -d
```

## Versioning

PhoenixStore follows semantic versioning with Firestore compatibility in mind:

```
x.y.z where:
x: Major version (matches compatible Firestore SDK version)
y: Feature updates and significant changes
z: Bug fixes and minor improvements
```

For example, version `1.2.3` means:
- Compatible with Firestore SDK v1.x.x
- Second feature release
- Third patch/fix release

### 2. Basic Usage

```typescript
import { PhoenixStore } from 'phoenixstore';

// Initialize
const db = new PhoenixStore(
  'mongodb://localhost:27017',
  'your_database'
);

// Connect
await db.connect();

// Add a document
const userId = await db.collection('users').add({
  name: 'John Doe',
  email: 'john@example.com'
});

// Get a document
const user = await db.collection('users').doc(userId).get();

// Update a document
await db.collection('users').doc(userId).update({
  name: 'Jane Doe'
});

// Delete a document
await db.collection('users').doc(userId).delete();
```

## Documentation

- [Architecture Overview](docs/architecture.md)
- [API Documentation](docs/api.md)
- [Contributing Guide](docs/contributing.md)

## Features

### Current Features
- ✅ Document CRUD operations
- ✅ MongoDB integration
- ✅ REST API
- ✅ TypeScript support
- ✅ Docker support
- ✅ Swagger documentation

### Coming Soon
- 🚧 Query operations (where, orderBy, limit)
- 🚧 Real-time updates
- 🚧 Flutter SDK
- 🚧 Authentication
- 🚧 Security rules

### Future Stretch Goals
- 🎯 Firebase Cloud Functions alternative (serverless functions, triggers)
- 🎯 Native Bun WebSockets implementation (replacing ws library)
- 🎯 Advanced caching and offline support
- 🎯 GraphQL API layer

## Development

### Prerequisites

- [Bun](https://bun.sh/) (v1.0.0 or higher)
- [Docker](https://www.docker.com/) and Docker Compose
- [Git](https://git-scm.com/)

### Setup

1. Clone the repository
   ```bash
   git clone https://github.com/yourusername/phoenixstore.git
   cd phoenixstore
   ```

2. Install dependencies
   ```bash
   bun install
   ```

3. Start services
   ```bash
   docker-compose up -d
   ```

4. Run tests
   ```bash
   bun test
   ```

For detailed development instructions, see our [Contributing Guide](docs/contributing.md).

## Examples

### REST API Example
```bash
# Create a document
curl -X POST http://localhost:3000/api/v1/users \
  -H "Content-Type: application/json" \
  -d '{"name": "John Doe", "email": "john@example.com"}'

# Get a document
curl http://localhost:3000/api/v1/users/123456
```

### TypeScript Example
```typescript
// Type-safe collections
interface User {
  name: string;
  email: string;
  age: number;
}

const users = db.collection<User>('users');
const user = await users.add({
  name: 'John',
  email: 'john@example.com',
  age: 30
});
```

## Contributing

We welcome contributions! Please see our [Contributing Guide](docs/contributing.md) for details.

## Support

- 📖 [Documentation](docs/)
- 💬 [Discord Community](https://discord.gg/your-server)
- 🐛 [Issue Tracker](https://github.com/yourusername/phoenixstore/issues)

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Acknowledgments

- Inspired by Firebase Firestore
- Built with [Bun](https://bun.sh/)
- Powered by [MongoDB](https://www.mongodb.com/)