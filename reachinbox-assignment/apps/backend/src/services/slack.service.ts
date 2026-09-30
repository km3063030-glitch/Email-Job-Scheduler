import crypto from 'node:crypto';
import { env } from '../config/env.js';
import { prisma } from '../lib/prisma.js';
import { redis } from '../lib/redis.js';

export async function createSlackAuthUrl(userId: string) {
  const state = crypto.randomBytes(24).toString('hex');
  await redis.set(`slack:oauth:${state}`, userId, 'EX', 600);
  const params = new URLSearchParams({
    client_id: env.SLACK_CLIENT_ID,
    scope: 'incoming-webhook',
    redirect_uri: env.SLACK_REDIRECT_URI,
    state,
  });
  return `https://slack.com/oauth/v2/authorize?${params.toString()}`;
}

export async function handleSlackCallback(code: string, state: string) {
  const userId = await redis.get(`slack:oauth:${state}`);
  if (!userId) throw new Error('Invalid or expired Slack state');
  await redis.del(`slack:oauth:${state}`);

  const response = await fetch('https://slack.com/api/oauth.v2.access', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: env.SLACK_CLIENT_ID,
      client_secret: env.SLACK_CLIENT_SECRET,
      code,
      redirect_uri: env.SLACK_REDIRECT_URI,
    }),
  });
  const data = await response.json() as any;
  if (!data.ok || !data.access_token || !data.team?.id) {
    throw new Error(data.error || 'Slack OAuth failed');
  }

  const channelId = data.incoming_webhook?.channel_id ?? null;
  const webhookUrl = data.incoming_webhook?.url ?? null;
  await prisma.slackConnection.upsert({
    where: { userId },
    update: {
      teamId: data.team.id,
      teamName: data.team.name ?? data.team.id,
      accessToken: data.access_token,
      channelId,
      webhookUrl,
    },
    create: {
      userId,
      teamId: data.team.id,
      teamName: data.team.name ?? data.team.id,
      accessToken: data.access_token,
      channelId,
      webhookUrl,
    },
  });

  return userId;
}

export async function notifySlackRateLimit(userId: string, senderEmail: string, limit: number) {
  const connection = await prisma.slackConnection.findUnique({ where: { userId } });
  if (!connection) return;
  if (!connection.webhookUrl) return;

  const response = await fetch(connection.webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      text: `ReachInbox rate limit reached for ${senderEmail}. The hourly limit of ${limit} emails was reached; queued emails are being rescheduled to the next available window.`,
    }),
  });
  if (!response.ok) throw new Error(`Slack webhook returned ${response.status}`);
}
