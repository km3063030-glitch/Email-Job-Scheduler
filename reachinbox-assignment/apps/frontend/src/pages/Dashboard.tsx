import { useEffect, useState } from 'react';
import { Sidebar } from '../components/Sidebar';
import { Header } from '../components/Header';
import { EmailList } from '../components/EmailList';
import { EmailDetail } from '../components/EmailDetail';
import { Compose } from './Compose';
import type { Email, User } from '../types';
import { api } from '../lib/api';

export function Dashboard({
  user,
  onLogout,
}: {
  user: User;
  onLogout: () => void;
}) {
  const [tab, setTab] = useState<'scheduled' | 'sent'>('scheduled');
  const [compose, setCompose] = useState(false);
  const [emails, setEmails] = useState<Email[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedEmail, setSelectedEmail] = useState<Email | null>(null);

  const load = async () => {
    setLoading(true);

    try {
      const result =
        tab === 'scheduled'
          ? await api.scheduled()
          : await api.sent();

      setEmails(result.emails);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!compose && !selectedEmail) {
      load();
    }
  }, [tab, compose, selectedEmail]);

  useEffect(() => {
    const timer = setTimeout(async () => {
      if (!search.trim()) {
        return;
      }

      try {
        const result = await api.search(search);
        setEmails(result.emails as Email[]);
      } catch (error) {
        console.error(error);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [search]);

  if (compose) {
    return (
      <Compose
        onBack={() => setCompose(false)}
        onScheduled={() => {
          setCompose(false);
          setTab('scheduled');
        }}
      />
    );
  }

  if (selectedEmail) {
    return (
      <EmailDetail
        email={selectedEmail}
        onBack={() => setSelectedEmail(null)}
      />
    );
  }

  return (
    <div className="app-shell">
      <Sidebar
        user={user}
        tab={tab}
        onTab={(nextTab) => {
          setSelectedEmail(null);
          setTab(nextTab);
        }}
        onCompose={() => setCompose(true)}
      />

      <section className="content">
        <Header
          user={user}
          search={search}
          setSearch={setSearch}
          onRefresh={load}
          onLogout={onLogout}
        />

        <EmailList
          emails={emails}
          tab={tab}
          loading={loading}
          onEmailClick={(email) => {
            setSelectedEmail(email);
          }}
        />
      </section>
    </div>
  );
}