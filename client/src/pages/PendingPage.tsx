import { useTranslation } from 'react-i18next';
import { useAuth } from '../auth/AuthContext';

export function PendingPage() {
  const { t } = useTranslation();
  const { me, logout } = useAuth();

  const rejected = me?.status === 'REJECTED';

  return (
    <div className="auth-wrap">
      <div className="auth-card text-center">
        <div style={{ fontSize: 48 }}>{rejected ? '⛔' : '⏳'}</div>
        <h2>{t('appName')}</h2>
        <div className={`alert ${rejected ? 'alert-error' : 'alert-warning'}`}>
          {rejected ? t('auth.rejectedNotice') : t('auth.pendingNotice')}
        </div>
        <p className="muted">
          {me?.firstName} {me?.lastName} — {me?.email}
        </p>
        <button className="btn btn-secondary w-full" onClick={logout}>
          {t('common.logout')}
        </button>
      </div>
    </div>
  );
}
