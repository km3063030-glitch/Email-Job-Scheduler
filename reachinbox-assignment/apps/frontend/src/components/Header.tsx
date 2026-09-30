import { useState } from 'react';
import { Filter, RefreshCw, LogOut, MessageSquareText } from 'lucide-react';
import type { User } from '../types';
import { Avatar } from './Avatar';
import { api } from '../lib/api';

export function Header({ user, search, setSearch, onRefresh, onLogout }: { user: User; search: string; setSearch: (value: string) => void; onRefresh: () => void; onLogout: () => void }) {
  const [open, setOpen] = useState(false);
  const [slackConnected, setSlackConnected] = useState(false);
  const [slackTeam, setSlackTeam] = useState<string | null>(null);

  const loadSlack = async () => {
    const status = await api.slackStatus();
    setSlackConnected(status.connected); setSlackTeam(status.teamName);
  };

  return (
    <header className="topbar">
      <div className="search-wrap"><span>⌕</span><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search" /></div>
      <div className="header-actions">
        <button className="icon-btn" title="Filter"><Filter size={18} /></button>
        <button className="icon-btn" title="Refresh" onClick={onRefresh}><RefreshCw size={18} /></button>
        <div className="user-menu-wrap">
          <button className="user-menu-btn" onClick={async () => { setOpen(v => !v); if (!open) await loadSlack(); }}><Avatar name={user.name} src={user.avatarUrl} size="sm" /></button>
          {open && <div className="user-menu">
            <div className="user-menu-head"><Avatar name={user.name} src={user.avatarUrl} /><div><strong>{user.name}</strong><span>{user.email}</span></div></div>
            <div className="menu-divider" />
            <button onClick={async () => { const { url } = await api.slackConnect(); window.location.href = url; }}><MessageSquareText size={16} />{slackConnected ? `Slack: ${slackTeam}` : 'Connect Slack'}</button>
            {slackConnected && <button onClick={async () => { await api.slackDisconnect(); await loadSlack(); }}><MessageSquareText size={16} />Disconnect Slack</button>}
            <button onClick={async () => { await api.logout(); onLogout(); }}><LogOut size={16} />Logout</button>
          </div>}
        </div>
      </div>
    </header>
  );
}
