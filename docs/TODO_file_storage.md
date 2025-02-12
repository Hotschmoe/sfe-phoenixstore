we need to add file storage to the project

should be super simple, already built container that we add to API endpoints and sdk wrapper

something like minio

```docker-compose.yml
services:
  minio:
    image: minio/minio
    ports:
      - "9000:9000"
      - "9001:9001"
    volumes:
      - minio_data:/data
    environment:
      MINIO_ROOT_USER: minioadmin
      MINIO_ROOT_PASSWORD: minioadmin
    command: server --console-address ":9001" /data

volumes:
  minio_data:
```





