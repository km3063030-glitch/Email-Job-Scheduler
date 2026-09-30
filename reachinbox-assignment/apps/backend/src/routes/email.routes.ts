import { Router } from 'express';
import multer from 'multer';
import { requireAuth } from '../middleware/auth.js';
import { createEtherealSender, listEmails, parseRecipientsFromText, scheduleEmails, searchEmails } from '../services/email.service.js';
import { getRateLimitWindow } from '../services/rate-limit.service.js';
import { prisma } from '../lib/prisma.js';



const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 2 * 1024 * 1024 } });
export const emailRouter = Router();
emailRouter.use(requireAuth);

emailRouter.get('/senders', async (req, res) => {
  const senders = await prisma.sender.findMany({ where: { userId: req.userId! }, orderBy: { createdAt: 'asc' } });
  res.json({ senders: senders.map(({ smtpPass, ...sender }) => sender) });
});

emailRouter.post('/senders', async (req, res) => {
  const sender = await createEtherealSender(req.userId!, String(req.body.name || 'Ethereal Sender'));
  const { smtpPass, ...safe } = sender;
  res.status(201).json({ sender: safe });
});

emailRouter.post('/parse-recipients', upload.single('file'), async (req, res) => {
  const text = req.file?.buffer.toString('utf8') ?? String(req.body.text ?? '');
  if (!text) return res.status(400).json({ message: 'Upload a CSV/text file or provide text' });
  const recipients = parseRecipientsFromText(text);
  res.json({ count: recipients.length, recipients });
});

emailRouter.post('/schedule', async (req, res) => {
  try {
    const recipients = Array.isArray(req.body.recipients) ? req.body.recipients : [];
    if (!recipients.length) return res.status(400).json({ message: 'At least one recipient is required' });
    const emails = await scheduleEmails(req.userId!, {
      subject: String(req.body.subject || ''),
      body: String(req.body.body || ''),
      startTime: String(req.body.startTime),
      delayBetweenEmailsMs: Number(req.body.delayBetweenEmailsMs),
      hourlyLimit: Number(req.body.hourlyLimit),
      senderId: String(req.body.senderId),
      recipients,
    });
    res.status(201).json({ count: emails.length, emails });
  } catch (error) {
    res.status(400).json({ message: error instanceof Error ? error.message : 'Could not schedule emails' });
  }
});

emailRouter.get('/scheduled', async (req, res) => res.json({ emails: await listEmails(req.userId!, 'SCHEDULED') }));
emailRouter.get('/sent', async (req, res) => res.json({ emails: await listEmails(req.userId!, 'SENT') }));
emailRouter.get('/failed', async (req, res) => res.json({ emails: await listEmails(req.userId!, 'FAILED') }));

emailRouter.get('/search', async (req, res) => {
  const q = String(req.query.q || '');
  res.json({ emails: await searchEmails(req.userId!, q) });
});

emailRouter.get('/rate-limit/:senderId', async (req, res) => {
  const sender = await prisma.sender.findFirst({ where: { id: req.params.senderId, userId: req.userId! } });
  if (!sender) return res.status(404).json({ message: 'Sender not found' });
  res.json(await getRateLimitWindow(sender.id, Number(req.query.limit || 200)));
});
