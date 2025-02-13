# Project Structure

```
sfe-phoenixstore/
├── docs/
│   ├── api.md              # API documentation with query operations
│   └── project_structure.md
├── src/
│   ├── adapters/
│   │   └── MongoAdapter.ts # MongoDB adapter with query operations
│   ├── api/
│   │   └── PhoenixApi.ts   # REST API with query endpoints
│   ├── core/
│   │   └── PhoenixStore.ts
│   ├── tests/
│   │   ├── MongoAdapter.query.test.ts  # Query operation tests
│   │   ├── MongoAdapter.test.ts        # Basic CRUD tests
│   │   ├── PhoenixStore.test.ts
│   │   └── setup.ts
│   ├── types/
│   │   └── index.ts        # Query types and operators
│   ├── utils/
│   │   └── config.ts
│   └── index.ts
├── node_modules/
├── .env
├── .env.example
├── .gitattributes
├── .gitignore
├── README.md
├── bun.lock
├── docker-compose.yml
├── Dockerfile
├── package.json
└── tsconfig.json
```
## Docker Container Structure

### Current Container Setup

The Dockerfile creates two stages:

#### Development Stage
```
/app/
├── src/             # Mounted from host
├── node_modules/    # Container-specific
├── package.json     # Copied from host
├── bun.lockb        # Copied from host
└── ... (all other files copied)
```

#### Production Stage
```
/app/
├── dist/           # Built output directory
│   └── index.js    # Compiled application
├── src/           # Source files
├── node_modules/  # Production dependencies only
├── package.json   # Copied from host
└── bun.lockb      # Copied from host
```

### Docker Compose Volume Mappings

The docker-compose.yml configures the following volume mappings:
```
Host                          Container
./                     ->    /app
(anonymous volume)     ->    /app/node_modules
mongodb_data          ->    /data/db (for MongoDB container)
```

Key Points:
- The entire project directory is mounted to `/app` in the container
- Node modules are kept in an anonymous volume to prevent host node_modules from overriding container modules
- MongoDB data is persisted in a named volume

