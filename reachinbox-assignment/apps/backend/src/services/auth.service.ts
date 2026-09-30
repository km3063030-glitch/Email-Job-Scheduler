import jwt from 'jsonwebtoken';
import { OAuth2Client } from 'google-auth-library';
import nodemailer from 'nodemailer';
import { env } from '../config/env.js';
import { prisma } from '../lib/prisma.js';

const googleClient = new OAuth2Client(env.GOOGLE_CLIENT_ID);

export async function loginWithGoogle(credential: string) {
  const ticket = await googleClient.verifyIdToken({
    idToken: credential,
    audience: env.GOOGLE_CLIENT_ID,
  });
  const payload = ticket.getPayload();
  if (!payload?.sub || !payload.email || !payload.email_verified) {
    throw new Error('Invalid Google account');
  }

  const user = await prisma.user.upsert({
    where: { googleId: payload.sub },
    update: {
      email: payload.email,
      name: payload.name ?? payload.email.split('@')[0],
      avatarUrl: payload.picture,
    },
    create: {
      googleId: payload.sub,
      email: payload.email,
      name: payload.name ?? payload.email.split('@')[0],
      avatarUrl: payload.picture,
    },
  });

  const sender = await prisma.sender.findFirst({ where: { userId: user.id } });
  if (!sender) {
    const account = await nodemailer.createTestAccount();
    await prisma.sender.create({
      data: {
        userId: user.id,
        name: user.name,
        email: account.user,
        smtpHost: account.smtp.host,
        smtpPort: account.smtp.port,
        smtpSecure: account.smtp.secure,
        smtpUser: account.user,
        smtpPass: account.pass,
      },
    });
  }

  const token = jwt.sign({ userId: user.id }, env.JWT_SECRET, { expiresIn: '7d' });
  return { user, token };
}
