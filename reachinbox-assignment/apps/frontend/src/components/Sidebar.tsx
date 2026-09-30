import { Clock3, Send, Plus } from 'lucide-react';
import type { User } from '../types';
import { Avatar } from './Avatar';

export function Sidebar({
  user,
  tab,
  onTab,
  onCompose,
}: {
  user: User;
  tab: 'scheduled' | 'sent';
  onTab: (tab: 'scheduled' | 'sent') => void;
  onCompose: () => void;
}) {
  return (
    <aside className="sidebar">
      <div className="brand">O N B</div>

      <div className="profile-card">
        <Avatar name={user.name} src={user.avatarUrl} />

        <div className="profile-copy">
          <strong>{user.name}</strong>
          <span>{user.email}</span>
        </div>

        <span className="chevron">⌄</span>
      </div>

      <button className="compose-btn" onClick={onCompose}>
        <Plus size={17} />
        <span>Compose</span>
      </button>

      <div className="sidebar-label">CORE</div>

      <button
        className={`nav-item ${tab === 'scheduled' ? 'active' : ''}`}
        onClick={() => onTab('scheduled')}
      >
        <Clock3 size={18} />
        <span>Scheduled</span>
      </button>

      <button
        className={`nav-item ${tab === 'sent' ? 'active' : ''}`}
        onClick={() => onTab('sent')}
      >
        <Send size={18} />
        <span>Sent</span>
      </button>
    </aside>
  );
}