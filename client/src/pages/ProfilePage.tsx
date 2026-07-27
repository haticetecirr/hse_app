import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api, errorMessage } from '../api/client';
import { useAuth } from '../auth/AuthContext';

function Row({ label, value }: { label: string; value?: React.ReactNode }) {
  if (value === undefined || value === null || value === '') return null;
  return (
    <div
      className="flex-between"
      style={{ padding: '6px 0', borderBottom: '1px solid #f1f5f9' }}
    >
      <span className="muted">{label}</span>
      <span style={{ fontWeight: 500, textAlign: 'right' }}>{value}</span>
    </div>
  );
}

export function ProfilePage() {
  const { t } = useTranslation();
  const { me, refresh } = useAuth();

  // Profil formu
  const [form, setForm] = useState({
    firstName: me?.firstName ?? '',
    lastName: me?.lastName ?? '',
    phone: me?.phone ?? '',
  });
  const [profileMsg, setProfileMsg] = useState('');
  const [profileErr, setProfileErr] = useState('');
  const [profileBusy, setProfileBusy] = useState(false);

  // Sifre formu
  const [pw, setPw] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [pwMsg, setPwMsg] = useState('');
  const [pwErr, setPwErr] = useState('');
  const [pwBusy, setPwBusy] = useState(false);

  if (!me) return null;

  async function saveProfile(e: React.FormEvent) {
    e.preventDefault();
    setProfileMsg('');
    setProfileErr('');
    setProfileBusy(true);
    try {
      await api.patch('/auth/profile', {
        firstName: form.firstName,
        lastName: form.lastName,
        phone: form.phone || undefined,
      });
      await refresh();
      setProfileMsg(t('profile.updated'));
    } catch (err) {
      setProfileErr(errorMessage(err));
    } finally {
      setProfileBusy(false);
    }
  }

  async function changePassword(e: React.FormEvent) {
    e.preventDefault();
    setPwMsg('');
    setPwErr('');
    if (pw.newPassword !== pw.confirmPassword) {
      setPwErr(t('profile.passwordMismatch'));
      return;
    }
    setPwBusy(true);
    try {
      await api.post('/auth/change-password', {
        currentPassword: pw.currentPassword,
        newPassword: pw.newPassword,
      });
      setPw({ currentPassword: '', newPassword: '', confirmPassword: '' });
      setPwMsg(t('profile.passwordChanged'));
    } catch (err) {
      setPwErr(errorMessage(err));
    } finally {
      setPwBusy(false);
    }
  }

  return (
    <div>
      <h1>👤 {t('profile.title')}</h1>

      <div className="row">
        {/* Hesap bilgileri (salt okunur) */}
        <div style={{ flex: 1, minWidth: 300 }}>
          <div className="card">
            <div className="card-title">{t('profile.accountInfo')}</div>
            <Row label={t('auth.email')} value={me.email} />
            <Row
              label={t('reports.status')}
              value={
                <span className="badge">{t(`status.${me.status}`)}</span>
              }
            />
            <Row
              label={t('admin.rank')}
              value={me.rank ? t(`rank.${me.rank}`) : t('admin.noRank')}
            />
            <Row
              label={t('admin.role')}
              value={
                me.isSuperAdmin
                  ? 'Super Admin'
                  : me.role?.name || t('admin.noRole')
              }
            />
            <Row
              label={t('admin.departments')}
              value={
                me.departments.length
                  ? me.departments.map((d) => d.name).join(', ')
                  : t('common.none')
              }
            />
          </div>
        </div>

        {/* Duzenlenebilir profil + sifre */}
        <div style={{ flex: 1, minWidth: 300 }}>
          <form className="card" onSubmit={saveProfile}>
            <div className="card-title">{t('profile.editProfile')}</div>
            {profileErr && (
              <div className="alert alert-error">{profileErr}</div>
            )}
            {profileMsg && (
              <div className="alert alert-success">{profileMsg}</div>
            )}
            <div className="field">
              <label>{t('auth.firstName')} *</label>
              <input
                value={form.firstName}
                onChange={(e) =>
                  setForm((f) => ({ ...f, firstName: e.target.value }))
                }
                required
              />
            </div>
            <div className="field">
              <label>{t('auth.lastName')} *</label>
              <input
                value={form.lastName}
                onChange={(e) =>
                  setForm((f) => ({ ...f, lastName: e.target.value }))
                }
                required
              />
            </div>
            <div className="field">
              <label>{t('auth.phone')}</label>
              <input
                value={form.phone}
                onChange={(e) =>
                  setForm((f) => ({ ...f, phone: e.target.value }))
                }
              />
            </div>
            <button className="btn" disabled={profileBusy}>
              {profileBusy ? t('common.loading') : t('common.save')}
            </button>
          </form>

          <form className="card" onSubmit={changePassword}>
            <div className="card-title">{t('profile.changePassword')}</div>
            {pwErr && <div className="alert alert-error">{pwErr}</div>}
            {pwMsg && <div className="alert alert-success">{pwMsg}</div>}
            <div className="field">
              <label>{t('profile.currentPassword')} *</label>
              <input
                type="password"
                value={pw.currentPassword}
                onChange={(e) =>
                  setPw((p) => ({ ...p, currentPassword: e.target.value }))
                }
                required
              />
            </div>
            <div className="field">
              <label>{t('profile.newPassword')} *</label>
              <input
                type="password"
                value={pw.newPassword}
                onChange={(e) =>
                  setPw((p) => ({ ...p, newPassword: e.target.value }))
                }
                required
                minLength={6}
              />
            </div>
            <div className="field">
              <label>{t('profile.confirmPassword')} *</label>
              <input
                type="password"
                value={pw.confirmPassword}
                onChange={(e) =>
                  setPw((p) => ({ ...p, confirmPassword: e.target.value }))
                }
                required
                minLength={6}
              />
            </div>
            <button className="btn" disabled={pwBusy}>
              {pwBusy ? t('common.loading') : t('profile.changePassword')}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
