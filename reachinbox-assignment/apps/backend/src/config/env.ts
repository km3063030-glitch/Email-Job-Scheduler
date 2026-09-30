import 'dotenv/config';
import { z } from 'zod';

const schema = z.object({
  NODE_ENV: z.string().default('development'),
  PORT: z.coerce.number().default(4000),
  FRONTEND_URL: z.string().url().default('http://localhost:5173'),
  DATABASE_URL: z.string().min(1),
  REDIS_URL: z.string().min(1),
  ELASTICSEARCH_URL: z.string().url().default('http://localhost:9200'),
  ELASTICSEARCH_INDEX: z.string().default('emails'),

  ETHEREAL_SMTP_HOST: z.string().default('smtp.ethereal.email'),
  ETHEREAL_SMTP_PORT: z.coerce.number().default(587),
  ETHEREAL_SMTP_SECURE: z.coerce.boolean().default(false),
  ETHEREAL_SMTP_USER: z.string().min(1),
  ETHEREAL_SMTP_PASS: z.string().min(1),

  JWT_SECRET: z.string().min(32),
  GOOGLE_CLIENT_ID: z.string().min(1),
  SLACK_CLIENT_ID: z.string().min(1),
  SLACK_CLIENT_SECRET: z.string().min(1),
  SLACK_REDIRECT_URI: z.string().url(),
  WORKER_CONCURRENCY: z.coerce.number().int().positive().default(10),
  MIN_SEND_DELAY_MS: z.coerce.number().int().nonnegative().default(2000),
  MAX_EMAILS_PER_HOUR: z.coerce.number().int().positive().default(200),
  EMAIL_MAX_ATTEMPTS: z.coerce.number().int().positive().default(5),
});

export const env = schema.parse(process.env);
