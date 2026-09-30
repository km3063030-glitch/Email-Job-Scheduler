# ReachInbox – Full-stack Email Scheduler Assignment

A production-oriented TypeScript implementation of the assignment using:

- **Backend:** Express + TypeScript + Prisma + PostgreSQL
- **Queue:** BullMQ + Redis delayed jobs
- **Email:** Nodemailer + Ethereal SMTP
- **Search:** Elasticsearch
- **Notifications:** Slack OAuth + incoming webhook
- **Frontend:** React + TypeScript + Vite + Tailwind CSS + custom CSS for Figma-level spacing
- **Queue UI:** Bull Board

The frontend is intentionally styled around the supplied screenshots: left navigation, rounded search bar, Scheduled/Sent rows, compose screen, Send Later popover, and centered login card.

## 1. Prerequisites

Install:

- Node.js 20+
- npm 10+
- Docker Desktop
- A Google Cloud project
- A Slack app

Verify:

```bash
node -v
npm -v
docker -v
docker compose version
```

## 2. Start infrastructure

From the repository root:

```bash
docker compose up -d
```

This starts:

- PostgreSQL: `localhost:5432`
- Redis: `localhost:6379`
- Elasticsearch: `localhost:9200`

Check Elasticsearch:

```bash
curl http://localhost:9200
```

## 3. Configure Google Login

Create an OAuth client in Google Cloud Console.

For local development use a **Web application** client and add:

- Authorized JavaScript origin: `http://localhost:5173`
- Authorized redirect URI if your Google setup requires one: `http://localhost:5173`

Copy the Web Client ID into both:

```text
apps/frontend/.env
apps/backend/.env
```

Google Identity Services ID tokens are verified on the backend using Google's Node.js auth library. The backend checks the token audience, issuer, expiry and Google subject. The Google `sub` value is used as the stable provider identifier.

## 4. Configure Slack OAuth

Create a Slack app at Slack API.

Under OAuth & Permissions:

1. Add redirect URL:

```text
http://localhost:4000/api/slack/callback
```

2. Request the `incoming-webhook` scope.
3. Install the app into your test workspace.
4. Put the Slack Client ID and Client Secret in `.env`.

The OAuth state is stored in Redis for 10 minutes. The successful OAuth response stores the Slack workspace, webhook URL and token in PostgreSQL. When the sender rate limit is reached, the worker sends a live Slack webhook notification. If Slack is not connected, the scheduler continues normally.

## 5. Backend environment

Copy:

```bash
cp apps/backend/.env.example apps/backend/.env
cp apps/frontend/.env.example apps/frontend/.env
```

Edit `apps/backend/.env`:

```env
NODE_ENV=development
PORT=4000
FRONTEND_URL=http://localhost:5173
DATABASE_URL=postgresql://reachinbox:reachinbox@localhost:5432/reachinbox?schema=public
REDIS_URL=redis://localhost:6379
ELASTICSEARCH_URL=http://localhost:9200
ELASTICSEARCH_INDEX=emails
JWT_SECRET=replace-with-at-least-32-random-characters
GOOGLE_CLIENT_ID=YOUR_GOOGLE_WEB_CLIENT_ID
SLACK_CLIENT_ID=YOUR_SLACK_CLIENT_ID
SLACK_CLIENT_SECRET=YOUR_SLACK_CLIENT_SECRET
SLACK_REDIRECT_URI=http://localhost:4000/api/slack/callback
WORKER_CONCURRENCY=10
MIN_SEND_DELAY_MS=2000
MAX_EMAILS_PER_HOUR=200
EMAIL_MAX_ATTEMPTS=5
```

Edit `apps/frontend/.env`:

```env
VITE_API_URL=http://localhost:4000
VITE_GOOGLE_CLIENT_ID=YOUR_GOOGLE_WEB_CLIENT_ID
```

## 6. Install dependencies

From the root:

```bash
npm install
```

## 7. Create database schema

```bash
npm run db:generate
npm run db:migrate -- --name init
npm run db:seed
```

`db:seed` creates a demo user and an Ethereal sender. Normal Google login also provisions an Ethereal sender automatically for a new user.

## 8. Run the application

Terminal 1 – API:

```bash
npm run dev:backend
```

Terminal 2 – BullMQ worker:

```bash
npm run worker
```

Terminal 3 – React:

```bash
npm run dev:frontend
```

Open:

```text
http://localhost:5173
```

Bull Board:

```text
http://localhost:4000/admin/queues
```

Bull Board is protected by the same application session as the API.

## 9. Scheduling architecture

```text
React Compose
    |
    | POST /api/emails/schedule
    v
Express API
    |
    +--> PostgreSQL: create one Email row per recipient
    |
    +--> BullMQ: one delayed job per Email row
    |
    v
Redis delayed set
    |
    | at scheduled time
    v
BullMQ Worker(s)
    |
    +--> Redis atomic hourly sender counter
    |
    +--> Redis atomic minimum-send-delay reservation
    |
    +--> PostgreSQL idempotency/status transition
    |
    +--> Ethereal SMTP
    |
    +--> PostgreSQL: SENT / FAILED + preview URL
    |
    +--> Elasticsearch index update
    |
    +--> Slack webhook when an hourly limit is reached
```

BullMQ delayed jobs live in Redis, so a restart of the Express API or worker does not recreate the schedule from application memory. BullMQ handles delayed-job promotion and worker recovery from Redis; no cron library or OS cron is used.

## 10. Concurrency and throttling

### Worker concurrency

Configured with:

```env
WORKER_CONCURRENCY=10
```

Multiple worker processes can be started against the same Redis queue. BullMQ coordinates job ownership.

### Minimum delay

The worker uses an atomic Redis reservation key per sender. The configured minimum is:

```env
MIN_SEND_DELAY_MS=2000
```

So even if 10 worker jobs become active together, the same sender gets send slots at least 2 seconds apart.

### Hourly limit

The worker uses a Redis key per sender + UTC hour:

```text
email-rate:<senderId>:<hourStart>
```

A Redis Lua script increments the counter only if the current count is below the configured limit. When the limit is reached, the job is moved back into BullMQ's delayed set for the next hour rather than failed or dropped.

The dashboard's Hourly Limit field is stored in the job data, while `MAX_EMAILS_PER_HOUR` is the server fallback.

### Slack notification

A second Redis key ensures the same sender/hour triggers one Slack notification rather than hundreds of identical messages when a large batch hits the limit.

## 11. Restart behavior

To demo persistence:

1. Schedule emails 2–5 minutes in the future.
2. Confirm jobs are visible in `/admin/queues`.
3. Stop the worker and API.
4. Start both again.
5. BullMQ reads the delayed jobs from Redis and processes them at their scheduled time.
6. PostgreSQL retains the email records and Elasticsearch retains the search documents.

No in-memory schedule is required.

## 12. Idempotency

Each email has a stable database ID and a deterministic BullMQ job ID:

```text
email:<emailId>
```

The worker checks the database status and skips an already `SENT` email. Normal BullMQ retries therefore do not send a completed email twice.

There is one unavoidable SMTP boundary: no SMTP server can give the application a transaction that atomically commits the database status and the external SMTP send. A process crash in the tiny interval after SMTP accepts a message but before PostgreSQL records `SENT` can theoretically cause a retry. The implementation documents this as an external-provider exactly-once limitation rather than pretending it can be solved by an in-memory flag.

For a real provider, use a provider-supported idempotency key if available. Ethereal/Nodemailer does not provide such a transactional idempotency API.

## 13. Elasticsearch search

Every scheduled email is indexed when created. Every status transition re-indexes the document.

The top search bar calls:

```text
GET /api/emails/search?q=<term>
```

Search fields include recipient, subject and body. Results are scoped to the logged-in user.

## 14. Ethereal

The implementation uses `nodemailer.createTestAccount()` to create a fake SMTP account. Ethereal never delivers to real recipients. After a successful send, Nodemailer returns an Ethereal preview URL which is stored in the email record.

This is ideal for the demo because you can show the sent email without contacting real users.

## 15. CSV upload format

Any CSV/text file containing addresses is accepted. Example:

```csv
email
alice@example.com
bob@example.com
carol@example.com
```

The parser scans the file for email-looking values, removes duplicates and displays the detected count in the compose screen.

## 16. Demo checklist for the 5-minute video

### 0:00–0:30 – Login

- Open the app.
- Click the real Google Login button.
- Show name, email and avatar in the header.

### 0:30–1:30 – Compose

- Click Compose.
- Upload a CSV with 5–10 test addresses.
- Show detected recipient count.
- Enter subject/body.
- Select the Ethereal sender.
- Set a short start time and a delay such as 2 seconds.
- Set hourly limit to something intentionally small for the rate-limit demo.
- Click Schedule.

### 1:30–2:15 – Scheduled

- Show the scheduled list.
- Open Bull Board in another tab and show delayed jobs.

### 2:15–3:00 – Sent

- Wait for a few jobs to process.
- Show Sent.
- Open the stored Ethereal preview URL if desired.

### 3:00–4:00 – Restart

- Stop the worker.
- Schedule another future email.
- Stop/restart the worker.
- Show that the delayed BullMQ job is still present and is processed later.

### 4:00–5:00 – Slack/rate limiting

- Connect Slack from the avatar menu.
- Use a low hourly limit, e.g. 2.
- Schedule several emails.
- Show the first emails sending.
- Show the Slack notification when the limit is reached.
- Show remaining jobs delayed into the next available hour window.

## 17. Features mapped to assignment

### Backend

- Express + TypeScript: implemented
- PostgreSQL relational persistence: implemented
- BullMQ + Redis delayed jobs: implemented
- No cron: implemented
- Ethereal SMTP: implemented
- Multiple senders: implemented through sender records and Ethereal account creation
- Worker concurrency: configurable
- Per-sender minimum delay: Redis atomic reservation
- Per-sender hourly limit: Redis Lua counter
- Reschedule instead of drop: implemented
- Slack OAuth + live webhook notification: implemented
- Elasticsearch indexing/search: implemented
- Bull Board: implemented
- Restart persistence: implemented
- Status/idempotency gate: implemented

### Frontend

- Real Google login: implemented
- User name/email/avatar: implemented
- Logout: implemented
- Scheduled view: implemented
- Sent view: implemented
- Compose screen: implemented
- CSV upload + recipient count: implemented
- Start time: implemented
- Delay: implemented
- Hourly limit: implemented
- Loading and empty states: implemented
- Search: implemented
- Slack connect/disconnect: implemented
- Figma-inspired visual system: implemented

## 18. Production hardening after the assignment

If this were moving beyond the take-home environment, I would add:

- Secret encryption/KMS for SMTP and Slack tokens at rest
- CSRF protection for cookie-authenticated mutations
- Stronger OAuth state/origin validation
- Rate-limit configuration persisted as a first-class sender policy
- Transactional outbox/event log for stronger delivery recovery
- Provider-level idempotency keys
- Structured metrics/tracing
- Dead-letter queue and operational alerts
- Pagination instead of 500-row list limits
- Elasticsearch aliases and lifecycle policies
- Automated integration tests using Testcontainers
