export type Email = {
  id: string;
  to: string;
  subject: string;
  body: string;
  status: 'SCHEDULED' | 'SENDING' | 'SENT' | 'FAILED';
  scheduledAt: string;
  sentAt?: string | null;
  failedAt?: string | null;
  messageId?: string | null;
  etherealPreviewUrl?: string | null;
  error?: string | null;

  sender?: {
    name: string;
    email: string;
  };
};