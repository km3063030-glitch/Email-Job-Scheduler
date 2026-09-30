import { Router } from 'express';
import { loginWithGoogle } from '../services/auth.service.js';
import { requireAuth } from '../middleware/auth.js';
import { prisma } from '../lib/prisma.js';
import { env } from '../config/env.js';

export const authRouter = Router();

authRouter.post('/google', async (req, res) => {
  try {
    const { credential } = req.body as { credential?: string };
    if (!credential) return res.status(400).json({ message: 'credential is required' });
    const { user, token } = await loginWithGoogle(credential);
    res.cookie('session', token, {
      httpOnly: true,
      sameSite: 'lax',
      secure: env.NODE_ENV === 'production',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });
    res.json({ user: { id: user.id, name: user.name, email: user.email, avatarUrl: user.avatarUrl } });
  } catch (error) {
    res.status(401).json({ message: error instanceof Error ? error.message : 'Google login failed' });
  }
});

authRouter.post('/logout', (_req, res) => {
  res.clearCookie('session');
  res.status(204).end();
});

authRouter.get('/me', requireAuth, async (req, res) => {
  const user = await prisma.user.findUnique({
    where: { id: req.userId! },
    select: { id: true, name: true, email: true, avatarUrl: true },
  });
  res.json({ user });
});
