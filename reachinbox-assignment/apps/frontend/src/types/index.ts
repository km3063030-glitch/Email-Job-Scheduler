export type User = {
  id: string;
  email: string;
  name: string;
  avatarUrl?: string | null;
};

export type Sender = {
  id: string;
  name: string;
  email: string;
};

export type Email = {
  id: string;
  to: string;
  subject: string;
  body: string;
  status: 'SCHEDULED' | 'SENDING' | 'SENT' | 'FAILED';
  scheduledAt: string;
  sentAt?: string | null;
  failedAt?: string | null;
  error?: string | null;
  messageId?: string | null;
  etherealPreviewUrl?: string | null;
  sender?: Sender;
  createdAt?: string;
};

export type AuthResponse = {
  user: User;
};