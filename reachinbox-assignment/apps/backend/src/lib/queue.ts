import { Queue } from 'bullmq';
import { bullConnection } from './redis.js';
import { env } from '../config/env.js';

export const EMAIL_QUEUE = 'email-send-queue';
export const emailQueue = new Queue(EMAIL_QUEUE, {
  connection: bullConnection,
  defaultJobOptions: {
    attempts: env.EMAIL_MAX_ATTEMPTS,
    backoff: { type: 'exponential', delay: 5000 },
    removeOnComplete: { age: 86400, count: 5000 },
    removeOnFail: { age: 604800, count: 5000 },
  },
});
