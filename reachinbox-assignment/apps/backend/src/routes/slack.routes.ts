import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { createSlackAuthUrl, handleSlackCallback } from '../services/slack.service.js';
import { prisma } from '../lib/prisma.js';
import { env } from '../config/env.js';

export const slackRouter = Router();

slackRouter.get('/connect', requireAuth, async (req, res) => {
  const url = await createSlackAuthUrl(req.userId!);
  res.json({ url });
});

slackRouter.get('/callback', async (req, res) => {
  try {
    const code = String(req.query.code || '');
    const state = String(req.query.state || '');
    await handleSlackCallback(code, state);
    res.redirect(`${env.FRONTEND_URL}/?slack=connected`);
  } catch (error) {
    res.redirect(`${env.FRONTEND_URL}/?slack=error`);
  }
});

slackRouter.get('/status', requireAuth, async (req, res) => {
  const connection = await prisma.slackConnection.findUnique({ where: { userId: req.userId! } });
  res.json({ connected: Boolean(connection), teamName: connection?.teamName ?? null });
});

slackRouter.delete('/disconnect', requireAuth, async (req, res) => {
  await prisma.slackConnection.deleteMany({ where: { userId: req.userId! } });
  res.status(204).end();
});
