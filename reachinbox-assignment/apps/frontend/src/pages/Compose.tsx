import { useEffect, useMemo, useRef, useState } from 'react';

import {
  ArrowLeft,
  Paperclip,
  Clock3,
  CalendarDays,
  FileText,
  X,
  Undo2,
  Redo2,
  Bold,
  Italic,
  Underline,
  AlignLeft,
  AlignCenter,
  AlignRight,
  List,
  ListOrdered,
  IndentIncrease,
  IndentDecrease,
  Quote,
  RemoveFormatting,
} from 'lucide-react';

import type { Sender } from '../types';

import { api } from '../lib/api';

export function Compose({
  onBack,
  onScheduled,
}: {
  onBack: () => void;
  onScheduled: () => void;
}) {
  const [senders, setSenders] = useState<Sender[]>([]);
  const [senderId, setSenderId] = useState('');

  const [toText, setToText] = useState('');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');

  const [startTime, setStartTime] = useState('');

  const [delaySeconds, setDelaySeconds] = useState(2);
  const [hourlyLimit, setHourlyLimit] = useState(200);

  const [recipients, setRecipients] = useState<string[]>([]);

  const [fileName, setFileName] = useState('');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [showLater, setShowLater] = useState(false);

  const editorRef = useRef<HTMLDivElement>(null);

  const [attachments, setAttachments] = useState<File[]>([]);

  useEffect(() => {
    api
      .senders()
      .then(({ senders }) => {
        setSenders(senders);

        if (senders[0]) {
          setSenderId(senders[0].id);
        }
      })
      .catch((e) => setError(e.message));
  }, []);

  const parsedManual = useMemo(
    () =>
      toText
        .split(/[\s,;]+/)
        .map((v) => v.trim().toLowerCase())
        .filter((v) =>
          /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v),
        ),
    [toText],
  );

  const allRecipients = useMemo(
    () => [...new Set([...recipients, ...parsedManual])],
    [recipients, parsedManual],
  );

  const uploadAttachment = (file: File) => {
    setError('');

    const allowedTypes = [
      'application/pdf',
      'image/jpeg',
      'image/png',
      'image/gif',
      'image/webp',
    ];

    if (!allowedTypes.includes(file.type)) {
      setError(
        'Only PDF and image files are allowed.',
      );
      return;
    }

    const maxSize = 10 * 1024 * 1024;

    if (file.size > maxSize) {
      setError(
        'Attachment must be smaller than 10MB.',
      );
      return;
    }

    setAttachments((current) => [
      ...current,
      file,
    ]);
  };

  const upload = async (file: File) => {
    try {
      setError('');
      setFileName(file.name);

      const result = await api.parseRecipients(file);

      if (!result.recipients || result.recipients.length === 0) {
        setError('No valid email addresses found in the file.');
        setRecipients([]);
        return;
      }

      setRecipients(result.recipients);
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : 'Could not parse recipient file',
      );
    }
  };

  const formatText = (
    command: string,
    value?: string,
  ) => {
    editorRef.current?.focus();

    document.execCommand(
      command,
      false,
      value,
    );

    setBody(
      editorRef.current?.innerHTML || '',
    );
  };

  const handleEditorInput = () => {
    setBody(
      editorRef.current?.innerHTML || '',
    );
  };

  const schedule = async () => {
    if (
      !senderId ||
      !subject.trim() ||
      !body.trim() ||
      !allRecipients.length
    ) {
      setError(
        'Sender, recipients, subject and body are required.',
      );

      return;
    }

    if (!startTime) {
      setError(
        'Please select a date and time.',
      );

      return;
    }

    const selectedTime = new Date(startTime);

    if (Number.isNaN(selectedTime.getTime())) {
      setError(
        'Please select a valid date and time.',
      );

      return;
    }

    if (selectedTime.getTime() <= Date.now()) {
      setError(
        'Please select a future date and time.',
      );

      return;
    }

    setLoading(true);
    setError('');

    try {
      await api.schedule({
        senderId,
        recipients: allRecipients,
        subject,
        body,
        startTime: selectedTime.toISOString(),
        delayBetweenEmailsMs:
          delaySeconds * 1000,
        hourlyLimit,
      });

      onScheduled();
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : 'Could not schedule emails',
      );
    } finally {
      setLoading(false);
    }
  };

  const setTomorrow = (hour?: number) => {
    const date = new Date();

    date.setDate(
      date.getDate() + 1,
    );

    if (hour !== undefined) {
      date.setHours(
        hour,
        0,
        0,
        0,
      );
    }

    const localDate = new Date(
      date.getTime() -
        date.getTimezoneOffset() * 60000,
    )
      .toISOString()
      .slice(0, 16);

    setStartTime(localDate);
  };

  return (
    <main className="compose-page">
      <div className="compose-titlebar">
        <button
          className="back-btn"
          onClick={onBack}
        >
          <ArrowLeft size={24} />
        </button>

        <h1>Compose New Email</h1>

        <div className="compose-top-actions">
          <label
            className="icon-btn"
            title="Attach"
            style={{ cursor: 'pointer' }}
          >
            <Paperclip size={23} />

            <input
              type="file"
              hidden
              accept=".pdf,image/jpeg,image/png,image/gif,image/webp"
              onChange={(e) => {
                if (e.target.files?.[0]) {
                  uploadAttachment(e.target.files[0]);
                }
              }}
            />
          </label>

          <button
            className="icon-btn"
            title="Schedule"
            type="button"
            onClick={() => setShowLater((v) => !v)}
          >
            <Clock3 size={23} />
          </button>

          <button
            className="send-later-btn"
            type="button"
            onClick={() => setShowLater((v) => !v)}
          >
            {showLater ? 'Schedule' : 'Send Later'}
          </button>
        </div>
      </div>

      <div className="compose-form">
        {/* FROM */}

        <div className="form-row">
          <label>From</label>

          <select
            value={senderId}
            onChange={(e) =>
              setSenderId(e.target.value)
            }
          >
            <option value="">
              Select sender
            </option>

            {senders.map((s) => (
              <option
                key={s.id}
                value={s.id}
              >
                {s.email}
              </option>
            ))}
          </select>
        </div>

        {/* TO */}

        <div className="form-row">
          <label>To</label>

          <div className="to-field">
            <input
              value={toText}
              onChange={(e) =>
                setToText(e.target.value)
              }
              placeholder="recipient@example.com"
            />

            <label className="upload-link">
              <input
                type="file"
                accept=".csv,.txt,text/csv,text/plain"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    upload(file);
                    e.target.value = '';
                  }
                }}
              />

              ↥ Upload List
            </label>
          </div>
        </div>

        {/* SUBJECT */}

        <div className="form-row">
          <label>Subject</label>

          <input
            value={subject}
            onChange={(e) =>
              setSubject(e.target.value)
            }
            placeholder="Subject"
          />
        </div>

        {/* DELAY + HOURLY LIMIT */}

        <div className="schedule-controls">
          <label>
            Delay between 2 emails

            <input
              type="number"
              min="0"
              value={delaySeconds}
              onChange={(e) =>
                setDelaySeconds(
                  Number(e.target.value),
                )
              }
            />

            <span>sec</span>
          </label>

          <label>
            Hourly Limit

            <input
              type="number"
              min="1"
              value={hourlyLimit}
              onChange={(e) =>
                setHourlyLimit(
                  Number(e.target.value),
                )
              }
            />
          </label>
        </div>

        {/* EMAIL EDITOR */}

        <div className="editor">
          {/* TOOLBAR */}

          <div className="toolbar">
            <button
              type="button"
              title="Undo"
              onMouseDown={(e) =>
                e.preventDefault()
              }
              onClick={() =>
                formatText('undo')
              }
            >
              <Undo2 size={17} />
            </button>

            <button
              type="button"
              title="Redo"
              onMouseDown={(e) =>
                e.preventDefault()
              }
              onClick={() =>
                formatText('redo')
              }
            >
              <Redo2 size={17} />
            </button>

            <span>|</span>

            <select
              className="font-size-select"
              defaultValue="3"
              title="Font size"
              onChange={(e) =>
                formatText(
                  'fontSize',
                  e.target.value,
                )
              }
            >
              <option value="1">
                Small
              </option>

              <option value="3">
                Normal
              </option>

              <option value="5">
                Large
              </option>

              <option value="7">
                Huge
              </option>
            </select>

            <span>|</span>

            <button
              type="button"
              title="Bold"
              onMouseDown={(e) =>
                e.preventDefault()
              }
              onClick={() =>
                formatText('bold')
              }
            >
              <Bold size={17} />
            </button>

            <button
              type="button"
              title="Italic"
              onMouseDown={(e) =>
                e.preventDefault()
              }
              onClick={() =>
                formatText('italic')
              }
            >
              <Italic size={17} />
            </button>

            <button
              type="button"
              title="Underline"
              onMouseDown={(e) =>
                e.preventDefault()
              }
              onClick={() =>
                formatText('underline')
              }
            >
              <Underline size={17} />
            </button>

            <span>|</span>

            <button
              type="button"
              title="Align left"
              onMouseDown={(e) =>
                e.preventDefault()
              }
              onClick={() =>
                formatText(
                  'justifyLeft',
                )
              }
            >
              <AlignLeft size={17} />
            </button>

            <button
              type="button"
              title="Align center"
              onMouseDown={(e) =>
                e.preventDefault()
              }
              onClick={() =>
                formatText(
                  'justifyCenter',
                )
              }
            >
              <AlignCenter size={17} />
            </button>

            <button
              type="button"
              title="Align right"
              onMouseDown={(e) =>
                e.preventDefault()
              }
              onClick={() =>
                formatText(
                  'justifyRight',
                )
              }
            >
              <AlignRight size={17} />
            </button>

            <span>|</span>

            <button
              type="button"
              title="Numbered list"
              onMouseDown={(e) =>
                e.preventDefault()
              }
              onClick={() =>
                formatText(
                  'insertOrderedList',
                )
              }
            >
              <ListOrdered size={17} />
            </button>

            <button
              type="button"
              title="Bullet list"
              onMouseDown={(e) =>
                e.preventDefault()
              }
              onClick={() =>
                formatText(
                  'insertUnorderedList',
                )
              }
            >
              <List size={17} />
            </button>

            <button
              type="button"
              title="Increase indent"
              onMouseDown={(e) =>
                e.preventDefault()
              }
              onClick={() =>
                formatText('indent')
              }
            >
              <IndentIncrease size={17} />
            </button>

            <button
              type="button"
              title="Decrease indent"
              onMouseDown={(e) =>
                e.preventDefault()
              }
              onClick={() =>
                formatText('outdent')
              }
            >
              <IndentDecrease size={17} />
            </button>

            <button
              type="button"
              title="Quote"
              onMouseDown={(e) =>
                e.preventDefault()
              }
              onClick={() =>
                formatText(
                  'formatBlock',
                  'blockquote',
                )
              }
            >
              <Quote size={17} />
            </button>

            <button
              type="button"
              title="Clear formatting"
              onMouseDown={(e) =>
                e.preventDefault()
              }
              onClick={() =>
                formatText('removeFormat')
              }
            >
              <RemoveFormatting size={17} />
            </button>
          </div>

          {/* BODY */}

          <div
            ref={editorRef}
            className="email-body-editor"
            contentEditable
            suppressContentEditableWarning
            data-placeholder="Type Your Reply..."
            onInput={handleEditorInput}
          />
        </div>

        {/* ATTACHMENT */}

        {fileName && (
          <div className="attachment-card">
            <FileText size={18} />

            <div>
              <strong>{fileName}</strong>

              <span>
                {allRecipients.length} email addresses detected
              </span>
            </div>

            <button
              type="button"
              onClick={() => {
                setRecipients([]);
                setFileName('');
              }}
            >
              <X size={17} />
            </button>
          </div>
        )}

        {attachments.length > 0 && (
          <div className="attachment-card">
            <FileText size={18} />

            <div>
              <strong>
                {attachments.length}{' '}
                attachment
                {attachments.length === 1 ? '' : 's'}
              </strong>

              <span>
                {attachments
                  .map((file) => file.name)
                  .join(', ')}
              </span>
            </div>

            <button
              type="button"
              onClick={() => setAttachments([])}
            >
              <X size={17} />
            </button>
          </div>
        )}

        {/* FOOTER */}

        <div className="compose-footer">
          <div className="recipient-count">
            {allRecipients.length} recipient
            {allRecipients.length === 1
              ? ''
              : 's'}
          </div>

          <div className="footer-actions">
            <button
              className="cancel-btn"
              type="button"
              onClick={onBack}
            >
              Cancel
            </button>

            <button
              className="primary-btn"
              type="button"
              disabled={loading}
              onClick={schedule}
            >
              <CalendarDays size={17} />

              {loading
                ? 'Scheduling...'
                : 'Schedule'}
            </button>
          </div>
        </div>

        {/* SEND LATER */}
        {showLater && (
          <div className="schedule-popover">
            <strong>Send Later</strong>
            <label>
              Pick date & time
              <input type="datetime-local" value={startTime} onChange={e => setStartTime(e.target.value)} />
            </label>
            <div className="quick-times">
              <button onClick={() => setStartTime(new Date(Date.now() + 86400000).toISOString().slice(0,16))}>Tomorrow</button>
              <button onClick={() => setStartTime(new Date(Date.now() + 86400000 + 3600000).toISOString().slice(0,16))}>Tomorrow, 10:00 AM</button>
              <button onClick={() => setStartTime(new Date(Date.now() + 86400000 + 7200000).toISOString().slice(0,16))}>Tomorrow, 11:00 AM</button>
            </div>
            <div className="popover-actions">
              <button onClick={() => setShowLater(false)}>Cancel</button>
              <button onClick={() => setShowLater(false)}>Done</button>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}