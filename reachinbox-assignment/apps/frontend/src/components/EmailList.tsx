import { Star } from 'lucide-react';
import type { Email } from '../types';

export function EmailList({
  emails,
  tab,
  loading,
  onEmailClick,
}: {
  emails: Email[];
  tab: 'scheduled' | 'sent';
  loading: boolean;
  onEmailClick: (email: Email) => void;
}) {
  if (loading) {
    return (
      <div className="list-empty">
        <div className="spinner" />
        <p>Loading emails...</p>
      </div>
    );
  }

  if (!emails.length) {
    return (
      <div className="list-empty">
        <div className="empty-icon">
          {tab === 'scheduled' ? '◷' : '✓'}
        </div>

        <h3>
          {tab === 'scheduled'
            ? 'No scheduled emails'
            : 'No sent emails'}
        </h3>

        <p>
          {tab === 'scheduled'
            ? 'Your scheduled emails will appear here.'
            : 'Emails you send will appear here.'}
        </p>
      </div>
    );
  }

  return (
    <div className="email-list">
      {emails.map((email) => (
        <button
          key={email.id}
          type="button"
          className="email-row email-row-button"
          onClick={() => onEmailClick(email)}
        >
          <div className="recipient">
            <strong>{email.to}</strong>
          </div>

          <div className="email-meta">
            <strong>{email.subject}</strong>

            <span className="dash">-</span>

            <span className="preview">
              {getPreview(email.body)}
            </span>

            <span
              className={`status-pill ${
                email.status === 'SENT'
                  ? 'gray'
                  : 'orange'
              }`}
            >
              {email.status}
            </span>
          </div>

          <span
            className="star-btn"
            onClick={(event) => {
              event.stopPropagation();
            }}
          >
            <Star size={18} />
          </span>
        </button>
      ))}
    </div>
  );
}

function getPreview(body: string) {
  if (!body) {
    return '';
  }

  const text = body
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<\/p>/gi, ' ')
    .replace(/<[^>]*>/g, '')
    .replace(/\s+/g, ' ')
    .trim();

  return text.length > 120
    ? `${text.slice(0, 120)}...`
    : text;
}