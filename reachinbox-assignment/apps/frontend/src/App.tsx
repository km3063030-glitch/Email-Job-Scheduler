import { useEffect, useState } from 'react';
import { GoogleLogin } from '@react-oauth/google';
import { useLocation, useNavigate } from 'react-router-dom';
import { api } from './lib/api';
import type { User } from './types';
import { Dashboard } from './pages/Dashboard';

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [loginError, setLoginError] = useState('');
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    api.me().then(({ user }) => setUser(user)).catch(() => {}).finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (user && location.pathname === '/login') navigate('/', { replace: true });
  }, [user, location.pathname, navigate]);

  if (loading) return <div className="page-loader"><div className="spinner" /></div>;

  if (!user) {
    return (
      <main className="login-page">
        <section className="login-card">
          <h1>Login</h1>
          <GoogleLogin
            width="402"
            theme="filled_blue"
            size="large"
            shape="rectangular"
            text="signin_with"
            onSuccess={async ({ credential }) => {
              if (!credential) return;
              try {
                setLoginError('');
                const result = await api.googleLogin(credential);
                setUser(result.user);
              } catch (e) {
                setLoginError(e instanceof Error ? e.message : 'Login failed');
              }
            }}
            onError={() => setLoginError('Google login failed')}
          />
          <div className="or-divider"><span>or sign up through email</span></div>
          <input className="login-input" placeholder="Email ID" disabled />
          <input className="login-input" placeholder="Password" type="password" disabled />
          <button className="login-submit" disabled>Login</button>
          {loginError && <p className="error-text">{loginError}</p>}
          <p className="login-note">Use the Google button above for the required real OAuth login.</p>
        </section>
      </main>
    );
  }

  return <Dashboard user={user} onLogout={() => setUser(null)} />;
}
