import nodemailer from 'nodemailer';
import { Worker, DelayedError, UnrecoverableError, type Job } from 'bullmq';
import { prisma } from '../lib/prisma.js';
import { bullConnection, redis } from '../lib/redis.js';
import { EMAIL_QUEUE } from '../lib/queue.js';
import { env } from '../config/env.js';
import { indexEmail } from '../lib/elasticsearch.js';
import { notifySlackRateLimit } from '../services/slack.service.js';
import { reserveHourlySlot, reserveSendTime } from '../services/rate-limit.service.js';

async function notifyRateLimitOnce(userId: string, senderEmail: string, limit: number, senderId: string) {
  const hourStart = Math.floor(Date.now() / 3600000) * 3600000;
  const key = `slack-rate-notified:${senderId}:${hourStart}`;
  const first = await redis.set(key, '1', 'NX', 'EX', 7200);
  if (first === 'OK') {
    try { await notifySlackRateLimit(userId, senderEmail, limit); }
    catch (error) { console.error('Slack rate-limit notification failed', error); }
  }
}

async function processEmail(job: Job, token?: string) {
  const { emailId, userId, senderId, hourlyLimit } = job.data as {
    emailId: string; userId: string; senderId: string; hourlyLimit: number;
  };

  const email = await prisma.email.findUnique({ where: { id: emailId }, include: { sender: true } });
  if (!email) throw new UnrecoverableError('Email record not found');
  if (email.status === 'SENT') return { skipped: true };

  // Redis provides the cross-worker atomic minimum-delay gate.
  const sendAt = await reserveSendTime(senderId, env.MIN_SEND_DELAY_MS);
  if (sendAt > Date.now()) {
    await prisma.email.update({ where: { id: emailId }, data: { scheduledAt: new Date(sendAt), status: 'SCHEDULED' } });
    if (token) {
      await job.moveToDelayed(sendAt, token);
      throw new DelayedError();
    }
    return;
  }

  // Redis provides the cross-worker hourly sender limit.
  const limit = hourlyLimit || env.MAX_EMAILS_PER_HOUR;
  const rate = await reserveHourlySlot(senderId, limit);
  if (!rate.allowed) {
    await prisma.email.update({ where: { id: emailId }, data: { scheduledAt: new Date(rate.retryAt), status: 'SCHEDULED' } });
    await notifyRateLimitOnce(userId, email.sender.email, limit, senderId);
    if (token) {
      await job.moveToDelayed(rate.retryAt, token);
      throw new DelayedError();
    }
    return;
  }

  // Idempotency gate. A job with the same BullMQ jobId is only claimed once in normal operation.
  const claim = await prisma.email.updateMany({
    where: { id: emailId, status: { in: ['SCHEDULED', 'SENDING'] } },
    data: { status: 'SENDING' },
  });
  if (claim.count === 0) {
    const current = await prisma.email.findUnique({ where: { id: emailId } });
    if (current?.status === 'SENT') return { skipped: true };
    throw new Error('Email is not in a sendable state');
  }

  try {
    const transporter = nodemailer.createTransport({
      host: email.sender.smtpHost,
      port: email.sender.smtpPort,
      secure: email.sender.smtpSecure,
      auth: { user: email.sender.smtpUser, pass: email.sender.smtpPass },
    });

    const info = await transporter.sendMail({
      from: `ReachInbox <${email.sender.email}>`,
      to: email.to,
      subject: email.subject,
      text: email.body,
      html: email.body.replace(/\n/g, '<br />'),
      headers: { 'X-ReachInbox-Email-Id': email.id },
    });

    const previewUrl = nodemailer.getTestMessageUrl(info) || null;
    const updated = await prisma.email.update({
      where: { id: emailId },
      data: {
        status: 'SENT',
        sentAt: new Date(),
        messageId: info.messageId,
        etherealPreviewUrl: previewUrl,
        error: null,
      },
    });
    await indexEmail(updated);
    return { messageId: info.messageId, previewUrl };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const finalAttempt = job.attemptsMade + 1 >= (job.opts.attempts ?? env.EMAIL_MAX_ATTEMPTS);
    const updated = await prisma.email.update({
      where: { id: emailId },
      data: finalAttempt
        ? { status: 'FAILED', failedAt: new Date(), error: message }
        : { status: 'SCHEDULED', error: message },
    });
    await indexEmail(updated);
    throw error;
  }
}

export const worker = new Worker(EMAIL_QUEUE, processEmail, {
  connection: bullConnection,
  concurrency: env.WORKER_CONCURRENCY,
});

worker.on('completed', job => console.log(`Email job completed: ${job.id}`));
worker.on('failed', (job, err) => console.error(`Email job failed: ${job?.id}`, err));

console.log(`Email worker running with concurrency=${env.WORKER_CONCURRENCY}, minDelay=${env.MIN_SEND_DELAY_MS}ms`);
