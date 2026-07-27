import { ReactNode } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../auth/AuthContext';
import { hasPermission } from '../types';
import { NotificationBell } from './NotificationBell';
import i18n from '../i18n';

export function Layout({ children }: { children: ReactNode }) {
  const { t } = useTranslation();
  const { me, logout } = useAuth();
  const navigate = useNavigate();

  const canCreateAccident = hasPermission(me, 'REPORT_CREATE_ACCIDENT');
  const canCreateNearMiss = hasPermission(me, 'REPORT_CREATE_NEARMISS');
  const canViewReports = hasPermission(
    me,
    'REPORT_VIEW_OWN',
    'REPORT_VIEW_DEPARTMENT',
    'REPORT_VIEW_ALL',
  );
  const canUsers = hasPermission(me, 'USER_VIEW', 'USER_APPROVE', 'USER_MANAGE');
  const canRoles = hasPermission(me, 'ROLE_MANAGE');
  const canDepts = hasPermission(me, 'DEPARTMENT_MANAGE');
  const canAudit = hasPermission(me, 'AUDIT_VIEW');
  const showAdmin = canUsers || canRoles || canDepts || canAudit;

  function setLang(lang: string) {
    i18n.changeLanguage(lang);
    localStorage.setItem('lang', lang);
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <strong>İSG</strong>
          <span>{t('appSubtitle')}</span>
        </div>

        <NavLink to="/" className="nav-link" end>
          {t('nav.dashboard')}
        </NavLink>
        {canViewReports && (
          <NavLink to="/reports" className="nav-link">
            {t('nav.reports')}
          </NavLink>
        )}

        {(canCreateAccident || canCreateNearMiss) && (
          <div className="nav-section">{t('nav.reports')}</div>
        )}
        {canCreateAccident && (
          <NavLink to="/reports/new/accident" className="nav-link">
            {t('nav.newAccident')}
          </NavLink>
        )}
        {canCreateNearMiss && (
          <NavLink to="/reports/new/near-miss" className="nav-link">
            {t('nav.newNearMiss')}
          </NavLink>
        )}

        {showAdmin && <div className="nav-section">{t('nav.admin')}</div>}
        {canUsers && (
          <NavLink to="/admin/users" className="nav-link">
            {t('nav.users')}
          </NavLink>
        )}
        {canRoles && (
          <NavLink to="/admin/roles" className="nav-link">
            {t('nav.roles')}
          </NavLink>
        )}
        {canDepts && (
          <NavLink to="/admin/departments" className="nav-link">
            {t('nav.departments')}
          </NavLink>
        )}
        {canAudit && (
          <NavLink to="/admin/audit" className="nav-link">
            {t('nav.audit')}
          </NavLink>
        )}

        <div style={{ flex: 1 }} />
        <NavLink to="/profile" className="nav-link">
          {t('nav.profile')}
        </NavLink>
        <div
          className="nav-link"
          onClick={() => {
            logout();
            navigate('/login');
          }}
        >
          {t('common.logout')}
        </div>
      </aside>

      <div className="main">
        <div className="topbar">
          <div className="lang-switch">
            <button
              className={i18n.language === 'tr' ? 'active' : ''}
              onClick={() => setLang('tr')}
            >
              TR
            </button>
            <button
              className={i18n.language === 'en' ? 'active' : ''}
              onClick={() => setLang('en')}
            >
              EN
            </button>
          </div>
          <NotificationBell />
          <NavLink
            to="/profile"
            className="flex gap-8"
            style={{
              alignItems: 'center',
              textDecoration: 'none',
              color: 'inherit',
            }}
            title={t('profile.title')}
          >
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontWeight: 600, fontSize: 13 }}>
                {me?.firstName} {me?.lastName}
              </div>
              <div className="muted" style={{ fontSize: 11 }}>
                {me?.isSuperAdmin
                  ? 'Super Admin'
                  : me?.role?.name || t('admin.noRole')}
              </div>
            </div>
          </NavLink>
        </div>
        <div className="content">{children}</div>
      </div>
    </div>
  );
}
