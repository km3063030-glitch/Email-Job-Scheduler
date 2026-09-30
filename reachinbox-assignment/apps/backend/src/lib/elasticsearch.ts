import { Client } from '@elastic/elasticsearch';
import { env } from '../config/env.js';

export const es = new Client({ node: env.ELASTICSEARCH_URL });

export async function ensureEmailIndex() {
  const exists = await es.indices.exists({ index: env.ELASTICSEARCH_INDEX });
  if (!exists) {
    await es.indices.create({
      index: env.ELASTICSEARCH_INDEX,
      mappings: {
        properties: {
          id: { type: 'keyword' },
          userId: { type: 'keyword' },
          senderId: { type: 'keyword' },
          to: { type: 'text', fields: { keyword: { type: 'keyword' } } },
          subject: { type: 'text' },
          body: { type: 'text' },
          status: { type: 'keyword' },
          scheduledAt: { type: 'date' },
          sentAt: { type: 'date' },
          createdAt: { type: 'date' },
        },
      },
    });
  }
}

export async function indexEmail(email: any) {
  await es.index({
    index: env.ELASTICSEARCH_INDEX,
    id: email.id,
    document: {
      id: email.id,
      userId: email.userId,
      senderId: email.senderId,
      to: email.to,
      subject: email.subject,
      body: email.body,
      status: email.status,
      scheduledAt: email.scheduledAt,
      sentAt: email.sentAt,
      createdAt: email.createdAt,
    },
    refresh: 'wait_for',
  });
}
