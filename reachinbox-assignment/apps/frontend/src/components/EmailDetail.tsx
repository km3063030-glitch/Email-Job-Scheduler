import { ArrowLeft, ExternalLink } from 'lucide-react';
import type { Email } from '../types';

export function EmailDetail({
  email,
  onBack,
}: {
  email: Email;
  onBack: () => void;
}) {
  const senderName = email.sender?.name || 'ReachInbox';
  const senderEmail = email.sender?.email || '';

  const sentDate = email.sentAt
    ? new Date(email.sentAt)
    : null;

  return (
    <div className="email-detail-page">
      <div className="email-detail-header">
        <button
          type="button"
          className="email-detail-back"
          onClick={onBack}
        >
          <ArrowLeft size={20} />
        </button>

        <h1>Sent Email</h1>
      </div>

      <main className="email-detail-container">
        <div className="email-detail-card">

          <div className="email-detail-top">
            <div>
              <span className="email-detail-label">
                To
              </span>

              <div className="email-detail-recipient">
                {email.to}
              </div>
            </div>

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

          <div className="email-detail-divider" />

          <div className="email-detail-row">
            <span className="email-detail-label">
              From
            </span>

            <span>
              {senderName}
              {senderEmail
                ? ` <${senderEmail}>`
                : ''}
            </span>
          </div>

          <div className="email-detail-row">
            <span className="email-detail-label">
              Subject
            </span>

            <strong>{email.subject}</strong>
          </div>

          {sentDate && (
            <div className="email-detail-row">
              <span className="email-detail-label">
                Sent
              </span>

              <span>
                {sentDate.toLocaleString()}
              </span>
            </div>
          )}

          <div className="email-detail-divider" />

          <div className="email-detail-body">
            <div
              dangerouslySetInnerHTML={{
                __html: email.body || '',
              }}
            />
          </div>

          {email.etherealPreviewUrl && (
            <>
              <div className="email-detail-divider" />

              <div className="email-detail-preview">
                <a
                  href={email.etherealPreviewUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="ethereal-preview-btn"
                >
                  <ExternalLink size={16} />
                  Open Ethereal Preview
                </a>
              </div>
            </>
          )}

          {email.messageId && (
            <div className="email-message-id">
              Message ID: {email.messageId}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}