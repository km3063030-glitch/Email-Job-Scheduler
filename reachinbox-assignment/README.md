# ReachInbox

An email outreach application with a React frontend and an Express backend. The backend schedules email jobs through BullMQ and Redis, persists application data in PostgreSQL, and sends email through Ethereal during development.

## Prerequisites

- Node.js and npm
- Docker and Docker Compose, or local PostgreSQL, Redis, and Elasticsearch services
- Google OAuth credentials if using Google login
- An Ethereal Email account for testing outbound email

## Configuration

Copy the backend example environment file and fill in the required values:

```powershell
Copy-Item apps/backend/.env.example apps/backend/.env
```

Configure the database, Redis, OAuth, and SMTP values in `apps/backend/.env`. Keep `.env` files and secrets out of version control.

### Ethereal Email setup

1. Create a test account at [ethereal.email](https://ethereal.email/).
2. Copy the SMTP host, port, username, and password provided for the account into `apps/backend/.env`.
3. Set `ETHEREAL_SMTP_SECURE=false` when using port `587`.
4. Send a test email and view it in the Ethereal message preview. Ethereal captures messages for testing; it does not deliver them to real inboxes.

Required settings:

| Variable | Purpose |
| --- | --- |
| `ETHEREAL_SMTP_HOST` | Ethereal SMTP hostname |
| `ETHEREAL_SMTP_PORT` | SMTP port, usually `587` |
| `ETHEREAL_SMTP_SECURE` | Whether to use a secure TLS connection |
| `ETHEREAL_SMTP_USER` | Ethereal SMTP username |
| `ETHEREAL_SMTP_PASS` | Ethereal SMTP password |

Also configure `DATABASE_URL`, `REDIS_URL`, `FRONTEND_URL`, and a strong `JWT_SECRET`. Set the Google and Slack variables if using those integrations.

## Running locally

### 1. Start the infrastructure

Start PostgreSQL, Redis, and Elasticsearch using the repository's Docker Compose configuration, if available. Otherwise, start local instances and ensure their URLs match the backend environment variables:

- PostgreSQL: `DATABASE_URL`
- Redis: `REDIS_URL`
- Elasticsearch: `ELASTICSEARCH_URL`

### 2. Install dependencies

From the repository root:

```powershell
npm install
```

If the repository uses a different package manager, use the corresponding lockfile and install command.

### 3. Prepare the database

From `apps/backend`, run the database migration command defined by the backend package scripts. For a Prisma-based setup, this is typically:

```powershell
npx prisma migrate dev
```

### 4. Run the backend API

In a terminal:

```powershell
cd apps/backend
npm run dev
```

The API listens on the port configured by `PORT` (default `4000`).

### 5. Run the BullMQ worker

In a second terminal:

```powershell
cd apps/backend
npm run worker
```

The worker processes queued email jobs. Keep it running while testing scheduled sends. If the backend package uses a different worker script name, use the one defined in its `package.json`.

### 6. Run the frontend

In a third terminal:

```powershell
cd apps/frontend
npm run dev
```

Open the local URL printed by the frontend development server (typically `http://localhost:5173`). Ensure `FRONTEND_URL` in the backend environment matches it.

## Architecture overview

- **Frontend:** React application for authentication and managing email campaigns.
- **Backend API:** Express API for authentication, campaign operations, and scheduling requests.
- **PostgreSQL:** Stores application records, such as users, campaigns, and scheduled email state.
- **Redis and BullMQ:** Hold and distribute queued email jobs between the API and worker.
- **Worker:** Processes queued jobs and sends email through the configured SMTP provider.
- **Elasticsearch:** Configured for email search/indexing.

### Scheduling

The API accepts scheduling requests and adds email jobs to a BullMQ queue. Jobs are made available to the worker at their scheduled time. The worker handles delivery, updates the relevant application state, and applies the configured retry behavior for failed attempts.

### Persistence and restarts

Application records are stored in PostgreSQL, so they are not limited to the lifetime of an API process. BullMQ stores job data in Redis; configure Redis persistence (RDB snapshots or AOF) in deployments where queued and delayed jobs must survive a Redis restart. When services restart, the API and worker reconnect to Redis and continue processing retained jobs.

### Rate limiting and concurrency

`MAX_EMAILS_PER_HOUR` and `MIN_SEND_DELAY_MS` configure sending limits and spacing between sends. `WORKER_CONCURRENCY` controls how many jobs the worker processes concurrently. These are separate controls: concurrency limits simultaneous work, while rate limiting and delay settings constrain send frequency. `EMAIL_MAX_ATTEMPTS` configures the maximum delivery attempts.

## Implemented features

| Area | Features |
| --- | --- |
| Backend | Express API, email scheduling with BullMQ, PostgreSQL persistence, Redis-backed job queue, worker concurrency, send-rate controls, retry configuration, and SMTP delivery configuration |
| Frontend | Login, dashboard, email composition, and data tables for viewing and managing application records |

## Security notes

Use unique, strong secrets outside development. Never commit `.env` files or expose OAuth client secrets, SMTP credentials, database passwords, or JWT secrets in frontend code.
