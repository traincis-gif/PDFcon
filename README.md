# PDFlow

PDF processing SaaS platform with dual backend architecture (Python + Node.js), background job processing, and a Next.js frontend.

## Architecture

```
frontend/          Next.js 14 (React, TypeScript, Tailwind CSS)
backend/python/    FastAPI + Celery (PDF processing, OCR, heavy compute)
backend/node/      Fastify + BullMQ + Prisma (CRUD, real-time, file orchestration)
postgres           PostgreSQL 16 (primary datastore)
redis              Redis 7 (caching, job queues, sessions)
```

**Request flow:** Frontend --> Node API (CRUD, auth, uploads) --> Redis queue --> Node Worker (light jobs) or Python API (heavy PDF processing) --> Celery Worker --> PostgreSQL/S3.

## Prerequisites

| Tool       | Version  |
|------------|----------|
| Docker     | 24+      |
| Node.js    | 20+      |
| Python     | 3.12+    |
| npm        | 10+      |

## Quick Start (Docker)

```bash
# 1. Clone and enter the project
git clone <repo-url> && cd PDFcon

# 2. Create your environment file
cp .env.example .env

# 3. Start all services
docker compose up --build

# 4. Open the app
#    Frontend:    http://localhost:3000
#    Python API:  http://localhost:8000
#    Node API:    http://localhost:3001
```

To run in the background:

```bash
docker compose up -d --build
```

To stop everything:

```bash
docker compose down
```

To stop and remove all data (volumes):

```bash
docker compose down -v
```

## Local Development (without Docker)

### Python backend

```bash
cd backend/python
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

Celery worker (separate terminal):

```bash
celery -A app.worker worker --loglevel=info
```

### Node backend

```bash
cd backend/node
npm install
npx prisma generate
npx prisma migrate deploy
npm run dev
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

## Railway Deployment

Each service deploys independently on Railway. Connect your GitHub repo, then create services pointing to the appropriate paths.

### Setup steps

1. Create a new Railway project.
2. Add a **PostgreSQL** plugin and a **Redis** plugin from the Railway dashboard.
3. Create services for each component:
   - **python-api** -- root directory `backend/python`, uses `railway.toml` in that folder.
   - **python-worker** -- same root directory, override start command to `celery -A app.worker worker --loglevel=info --concurrency=2`.
   - **node-api** -- root directory `backend/node`, uses `railway.toml` in that folder.
   - **node-worker** -- same root directory, override start command to `node dist/src/worker.js`.
   - **frontend** -- root directory `frontend`, uses `railway.toml` in that folder.
4. Set environment variables in each service (reference the Railway-provisioned `DATABASE_URL` and `REDIS_URL` variables).
5. Deploy. Railway will detect the `railway.toml` and Procfile for build/start configuration.

### Environment variables on Railway

Set these in the Railway dashboard for each service. Use Railway's variable references (`${{Postgres.DATABASE_URL}}`) to connect plugins automatically.

## API Endpoints

### Python API (`:8000`)

| Method | Path                          | Description                     |
|--------|-------------------------------|---------------------------------|
| GET    | `/health`                     | Health check                    |
| POST   | `/api/v1/pdf/upload`          | Upload a PDF for processing     |
| GET    | `/api/v1/pdf/{id}/status`     | Check processing job status     |
| GET    | `/api/v1/pdf/{id}/download`   | Download processed PDF          |
| POST   | `/api/v1/pdf/merge`           | Merge multiple PDFs             |
| POST   | `/api/v1/pdf/split`           | Split PDF by page ranges        |
| POST   | `/api/v1/pdf/compress`        | Compress a PDF                  |
| POST   | `/api/v1/pdf/ocr`             | Run OCR on a scanned PDF        |

### Node API (`:3001`)

| Method | Path                          | Description                     |
|--------|-------------------------------|---------------------------------|
| GET    | `/health`                     | Health check                    |
| POST   | `/api/v1/auth/register`       | Register a new user             |
| POST   | `/api/v1/auth/login`          | Login and receive JWT           |
| GET    | `/api/v1/users/me`            | Get current user profile        |
| GET    | `/api/v1/documents`           | List user documents             |
| GET    | `/api/v1/documents/{id}`      | Get document details            |
| DELETE | `/api/v1/documents/{id}`      | Delete a document               |
| POST   | `/api/v1/upload/presign`      | Get S3 presigned upload URL     |
| POST   | `/api/v1/jobs`                | Create a processing job         |
| GET    | `/api/v1/jobs/{id}`           | Get job status                  |

## Environment Variables

| Variable                        | Description                              | Default / Example              |
|---------------------------------|------------------------------------------|--------------------------------|
| `DATABASE_URL`                  | PostgreSQL connection string             | `postgresql://pdflow:...`      |
| `REDIS_URL`                     | Redis connection string                  | `redis://localhost:6379/0`     |
| `JWT_SECRET`                    | Secret for signing JWTs                  | (generate with openssl)        |
| `S3_BUCKET`                     | S3 bucket for file uploads               | `pdflow-uploads`               |
| `S3_REGION`                     | AWS region for S3                        | `us-east-1`                    |
| `S3_ENDPOINT`                   | Custom S3 endpoint (MinIO, R2)           | (blank for AWS)                |
| `AWS_ACCESS_KEY_ID`             | AWS access key                           | --                             |
| `AWS_SECRET_ACCESS_KEY`         | AWS secret key                           | --                             |
| `CORS_ORIGINS`                  | Allowed CORS origins (comma-separated)   | `http://localhost:3000`        |
| `LOG_LEVEL`                     | Logging verbosity                        | `debug`                        |
| `CELERY_BROKER_URL`             | Celery broker (Redis)                    | `redis://localhost:6379/1`     |
| `CELERY_RESULT_BACKEND`         | Celery result backend (Redis)            | `redis://localhost:6379/2`     |
| `NEXT_PUBLIC_PYTHON_API_URL`    | Python API URL (frontend)                | `http://localhost:8000`        |
| `NEXT_PUBLIC_NODE_API_URL`      | Node API URL (frontend)                  | `http://localhost:3001`        |

## License

Proprietary. All rights reserved.
