import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import pinoHttp from 'pino-http';
import { createBullBoard } from '@bull-board/api';
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter';
import { ExpressAdapter } from '@bull-board/express';
import { emailQueue } from './lib/queue.js';
import { env } from './config/env.js';
import { ensureEmailIndex } from './lib/elasticsearch.js';
import { authRouter } from './routes/auth.routes.js';
import { emailRouter } from './routes/email.routes.js';
import { slackRouter } from './routes/slack.routes.js';
import { requireAuth } from './middleware/auth.js';

import './workers/email.worker.js';

const app = express();
app.use(cors({ origin: env.FRONTEND_URL, credentials: true }));
app.use(express.json({ limit: '2mb' }));
app.use(cookieParser());
app.use(pinoHttp());

app.get('/health', (_req, res) => res.json({ ok: true }));
app.use('/api/auth', authRouter);
app.use('/api/emails', emailRouter);
app.use('/api/slack', slackRouter);

const serverAdapter = new ExpressAdapter();
serverAdapter.setBasePath('/admin/queues');
createBullBoard({ queues: [new BullMQAdapter(emailQueue)], serverAdapter });
app.use('/admin/queues', requireAuth, serverAdapter.getRouter());

await ensureEmailIndex();

app.listen(env.PORT, () => {
  console.log(`API listening on http://localhost:${env.PORT}`);
  console.log(`BullMQ dashboard: http://localhost:${env.PORT}/admin/queues`);
});
