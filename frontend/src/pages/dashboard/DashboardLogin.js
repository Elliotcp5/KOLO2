import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import '../../pages/marketing/marketing.css';
import './dashboard.css';

const API = process.env.REACT_APP_BACKEND_URL;
const TOKEN_KEY = 'kolo_dashboard_token';

const DashboardLogin = () => {
  const nav = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  // If already logged in, redirect
  useEffect(() => {
    const token = localStorage.getItem(TOKEN_KEY);
    if (!token) return;
    (async () => {
      try {
        const r = await fetch(`${API}/api/dashboard/me`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (r.ok) nav('/dashboard', { replace: true });
      } catch { /* not authenticated, stay on login */ }
    })();
  }, [nav]);

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      const r = await fetch(`${API}/api/dashboard/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim().toLowerCase(), password }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.detail || 'Login failed');
      localStorage.setItem(TOKEN_KEY, data.token);
      nav('/dashboard', { replace: true });
    } catch (err) {
      setError(err.message || 'Login failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="dash-login-root" data-testid="dashboard-login">
      <div className="dash-login-card">
        <div className="dash-login-brand">
          <img src="/kolo-mark-v5-180.png" alt="KOLO" />
          <span>KOLO</span>
        </div>
        <h1 className="dash-login-title">Dashboard privé</h1>
        <p className="dash-login-sub">Accès réservé.</p>
        <form onSubmit={submit} className="dash-login-form">
          <label className="dash-field">
            <span>Email</span>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              required
              data-testid="dashboard-login-email"
            />
          </label>
          <label className="dash-field">
            <span>Mot de passe</span>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              required
              data-testid="dashboard-login-password"
            />
          </label>
          {error && <div className="dash-login-error" data-testid="dashboard-login-error">{error}</div>}
          <button
            type="submit"
            className="dash-login-submit"
            disabled={busy}
            data-testid="dashboard-login-submit"
          >
            {busy ? 'Connexion…' : 'Se connecter'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default DashboardLogin;
