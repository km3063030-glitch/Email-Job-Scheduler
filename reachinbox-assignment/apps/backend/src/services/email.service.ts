import nodemailer from 'nodemailer';
import { parse } from 'csv-parse/sync';
import { prisma } from '../lib/prisma.js';
import { emailQueue } from '../lib/queue.js';
import { indexEmail } from '../lib/elasticsearch.js';
import { env } from '../config/env.js';

export type ScheduleInput = {
  subject: string;
  body: string;
  startTime: string;
  delayBetweenEmailsMs: number;
  hourlyLimit: number;
  senderId: string;
  recipients: string[];
};

export function parseRecipientsFromText(input: string) {
  const rows = parse(input, { relax_column_count: true, skip_empty_lines: true }) as string[][];
  const emailRegex = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i;
  const emails = rows.flatMap(row => row).flatMap(value => value.match(emailRegex)?.[0] ?? []);
  return [...new Set(emails.map(e => e.trim().toLowerCase()))];
}

export async function scheduleEmails(userId: string, input: ScheduleInput) {
  const sender = await prisma.sender.findFirst({ where: { id: input.senderId, userId } });
  if (!sender) throw new Error('Sender not found');

  const start = new Date(input.startTime);
  if (Number.isNaN(start.getTime())) throw new Error('Invalid startTime');
  if (start.getTime() < Date.now() - 5000) throw new Error('Start time must be in the future');

  const created = [];
  for (let i = 0; i < input.recipients.length; i++) {
    const scheduledAt = new Date(start.getTime() + i * input.delayBetweenEmailsMs);
    const email = await prisma.email.create({
      data: {
        userId,
        senderId: sender.id,
        to: input.recipients[i],
        subject: input.subject,
        body: input.body,
        scheduledAt,
        sequence: i,
      },
    });

    const job = await emailQueue.add(
      'send-email',
      { emailId: email.id, userId, senderId: sender.id, hourlyLimit: input.hourlyLimit },
      {
        jobId: `email-${email.id}`,
        delay: Math.max(0, scheduledAt.getTime() - Date.now()),
      },
    );

    const updated = await prisma.email.update({
      where: { id: email.id },
      data: { bullJobId: job.id },
    });
    await indexEmail(updated);
    created.push(updated);
  }
  return created;
}

export async function createEtherealSender(userId: string, name: string) {
  return prisma.sender.create({
    data: {
      userId,
      name,
      email: env.ETHEREAL_SMTP_USER,
      smtpHost: env.ETHEREAL_SMTP_HOST,
      smtpPort: env.ETHEREAL_SMTP_PORT,
      smtpSecure: env.ETHEREAL_SMTP_SECURE,
      smtpUser: env.ETHEREAL_SMTP_USER,
      smtpPass: env.ETHEREAL_SMTP_PASS,
    },
  });
}

export async function listEmails(userId: string, status?: 'SCHEDULED' | 'SENT' | 'FAILED') {
  return prisma.email.findMany({
    where: { userId, ...(status ? { status } : {}) },
    include: { sender: { select: { name: true, email: true } } },
    orderBy: [{ scheduledAt: 'asc' }, { sequence: 'asc' }],
    take: 500,
  });
}

export async function searchEmails(userId: string, query: string) {
  const result = await import('../lib/elasticsearch.js').then(m => m.es.search({
    index: env.ELASTICSEARCH_INDEX,
    query: {
      bool: {
        filter: [{ term: { userId } }],
        must: query.trim() ? [{ multi_match: { query, fields: ['to', 'subject', 'body'], fuzziness: 'AUTO' } }] : [{ match_all: {} }],
      },
    },
    size: 100,
    sort: [{ createdAt: 'desc' }],
  }));
  return result.hits.hits.map(hit => hit._source);
}

export async function getEmailStats(userId: string) {
  const [scheduled, sent] = await Promise.all([
    prisma.email.count({
      where: {
        userId,
        status: 'SCHEDULED',
      },
    }),

    prisma.email.count({
      where: {
        userId,
        status: 'SENT',
      },
    }),
  ]);

  return {
    scheduled,
    sent,
  };
}
