import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { api, errorMessage } from '../api/client';

export function RegisterPage() {
  const { t } = useTranslation();
  const [form, setForm] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    password: '',
  });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [busy, setBusy] = useState(false);

  function set(k: string, v: string) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      await api.post('/auth/register', form);
      setSuccess(true);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  if (success) {
    return (
      <div className="auth-wrap">
        <div className="auth-card text-center">
          <div style={{ fontSize: 48 }}>✅</div>
          <h2>{t('auth.register')}</h2>
          <div className="alert alert-success">
            {t('auth.registerSuccess')}
          </div>
          <Link to="/login" className="btn w-full">
            {t('auth.login')}
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-wrap">
      <div className="auth-card">
        <div className="logo">
          <strong>{t('appName')}</strong>
          <div>{t('appSubtitle')}</div>
        </div>
        <h2>{t('auth.registerTitle')}</h2>
        {error && <div className="alert alert-error">{error}</div>}
        <form onSubmit={onSubmit}>
          <div className="row">
            <div className="field">
              <label>{t('auth.firstName')}</label>
              <input
                type="text"
                name="firstName"
                autoComplete="given-name"
                value={form.firstName}
                onChange={(e) => set('firstName', e.target.value)}
                required
              />
            </div>
            <div className="field">
              <label>{t('auth.lastName')}</label>
              <input
                type="text"
                name="lastName"
                autoComplete="family-name"
                value={form.lastName}
                onChange={(e) => set('lastName', e.target.value)}
                required
              />
            </div>
          </div>
          <div className="field">
            <label>{t('auth.email')}</label>
            <input
              type="email"
              name="email"
              autoComplete="email"
              value={form.email}
              onChange={(e) => set('email', e.target.value)}
              required
            />
          </div>
          <div className="field">
            <label>{t('auth.phone')}</label>
            <input
              type="tel"
              name="phone"
              autoComplete="tel"
              value={form.phone}
              onChange={(e) => set('phone', e.target.value)}
            />
          </div>
          <div className="field">
            <label>{t('auth.password')}</label>
            <input
              type="password"
              name="password"
              autoComplete="new-password"
              value={form.password}
              onChange={(e) => set('password', e.target.value)}
              required
              minLength={6}
            />
          </div>
          <button className="btn w-full" disabled={busy}>
            {busy ? t('common.loading') : t('auth.register')}
          </button>
        </form>
        <div className="text-center mt-16 muted">
          {t('auth.haveAccount')} <Link to="/login">{t('auth.login')}</Link>
        </div>
      </div>
    </div>
  );
}
