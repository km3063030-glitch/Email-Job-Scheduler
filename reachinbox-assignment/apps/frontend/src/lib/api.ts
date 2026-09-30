const API_URL =
  import.meta.env.VITE_API_URL || 'http://localhost:4000';

async function request<T>(
  path: string,
  init?: RequestInit,
): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers || {}),
    },
    ...init,
  });

  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.message || 'Request failed');
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return response.json();
}

export const api = {
  me: () =>
    request<{ user: import('../types').User }>(
      '/api/auth/me',
    ),

  googleLogin: (credential: string) =>
    request<{ user: import('../types').User }>(
      '/api/auth/google',
      {
        method: 'POST',
        body: JSON.stringify({ credential }),
      },
    ),

  logout: () =>
    request<void>('/api/auth/logout', {
      method: 'POST',
    }),

  senders: () =>
    request<{
      senders: import('../types').Sender[];
    }>('/api/emails/senders'),

  createSender: (name: string) =>
    request<{
      sender: import('../types').Sender;
    }>('/api/emails/senders', {
      method: 'POST',
      body: JSON.stringify({ name }),
    }),

  scheduled: () =>
    request<{
      emails: import('../types').Email[];
    }>('/api/emails/scheduled'),

  sent: () =>
    request<{
      emails: import('../types').Email[];
    }>('/api/emails/sent'),

  search: (q: string) =>
    request<{
      emails: import('../types').Email[];
    }>(
      `/api/emails/search?q=${encodeURIComponent(q)}`,
    ),

  schedule: (payload: unknown) =>
    request<{
      count: number;
      emails: import('../types').Email[];
    }>('/api/emails/schedule', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  parseRecipients: async (file: File) => {
    const formData = new FormData();

    formData.append('file', file);

    const response = await fetch(
      `${API_URL}/api/emails/parse-recipients`,
      {
        method: 'POST',
        credentials: 'include',
        body: formData,
      },
    );

    const data = await response.json();

    if (!response.ok) {
      throw new Error(
        data.message || 'Could not parse recipients',
      );
    }

    return data;
  },

  slackConnect: () =>
    request<{ url: string }>('/api/slack/connect'),

  slackStatus: () =>
    request<{
      connected: boolean;
      teamName: string | null;
    }>('/api/slack/status'),

  slackDisconnect: () =>
    request<void>('/api/slack/disconnect', {
      method: 'DELETE',
    }),
};