Example Usage of PhoenixStore with a Mock Frontend

this includes a mock frontend, built into container and ran with phoenixstore.

This showcases a complete end-to-end docker-compose setup for a production-ready PhoenixStore instance with any frontend project.

## Getting Started

To build and run the example:

1. Build the containers:
```bash
docker compose build
```

2. Start the services in detached mode:
```bash
docker compose up -d
```

The frontend will be available at http://localhost:80 and PhoenixStore API at http://localhost:3000.

To stop the services:
```bash
docker compose down
```
