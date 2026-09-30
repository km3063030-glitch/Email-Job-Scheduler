import { PrismaClient } from '@prisma/client';
import nodemailer from 'nodemailer';

const prisma = new PrismaClient();

async function main() {
  const user = await prisma.user.upsert({
    where: { googleId: 'demo-google-id' },
    update: {},
    create: {
      googleId: 'demo-google-id',
      email: 'demo@reachinbox.local',
      name: 'Oliver Brown',
      avatarUrl: null,
    },
  });

  const existing = await prisma.sender.findFirst({ where: { userId: user.id } });
  if (!existing) {
    const account = await nodemailer.createTestAccount();
    await prisma.sender.create({
      data: {
        userId: user.id,
        name: 'Oliver Brown',
        email: account.user,
        smtpHost: account.smtp.host,
        smtpPort: account.smtp.port,
        smtpSecure: account.smtp.secure,
        smtpUser: account.user,
        smtpPass: account.pass,
      },
    });
  }
}

main().finally(() => prisma.$disconnect());
