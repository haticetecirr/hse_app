import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { api } from '../api/client';
import { useAuth } from '../auth/AuthContext';

interface Stats {
  total: number;
  byType: Record<string, number>;
  byStatus: Record<string, number>;
  byRisk: Record<string, number>;
  openActions: number;
}

export function DashboardPage() {
  const { t } = useTranslation();
  const { me } = useAuth();

  const { data, isLoading } = useQuery({
    queryKey: ['stats'],
    queryFn: async () => (await api.get<Stats>('/reports/stats')).data,
  });

  return (
    <div>
      <h1>{t('dashboard.title')}</h1>
      <p className="muted">
        {t('dashboard.welcome')}, {me?.firstName} {me?.lastName}
      </p>

      {isLoading || !data ? (
        <div className="card">{t('common.loading')}</div>
      ) : (
        <>
          <div className="stat-grid">
            <div className="stat">
              <div className="stat-value">{data.total}</div>
              <div className="stat-label">{t('dashboard.totalReports')}</div>
            </div>
            <div className="stat">
              <div className="stat-value" style={{ color: 'var(--danger)' }}>
                {data.byType.ACCIDENT || 0}
              </div>
              <div className="stat-label">{t('dashboard.accidents')}</div>
            </div>
            <div className="stat">
              <div className="stat-value" style={{ color: 'var(--warning)' }}>
                {data.byType.NEAR_MISS || 0}
              </div>
              <div className="stat-label">{t('dashboard.nearMisses')}</div>
            </div>
            <div className="stat">
              <div className="stat-value" style={{ color: 'var(--accent)' }}>
                {data.openActions}
              </div>
              <div className="stat-label">{t('dashboard.openActions')}</div>
            </div>
          </div>

          <div className="row">
            <div className="card" style={{ flex: 1, minWidth: 280 }}>
              <div className="card-title">{t('dashboard.byStatus')}</div>
              {Object.keys(data.byStatus).length === 0 ? (
                <div className="muted">{t('common.noData')}</div>
              ) : (
                Object.entries(data.byStatus).map(([k, v]) => (
                  <div key={k} className="flex-between" style={{ padding: '6px 0' }}>
                    <span>{t(`reportStatus.${k}`)}</span>
                    <span className="badge">{v}</span>
                  </div>
                ))
              )}
            </div>

            <div className="card" style={{ flex: 1, minWidth: 280 }}>
              <div className="card-title">{t('dashboard.byRisk')}</div>
              {Object.keys(data.byRisk).length === 0 ? (
                <div className="muted">{t('common.noData')}</div>
              ) : (
                Object.entries(data.byRisk).map(([k, v]) => (
                  <div key={k} className="flex-between" style={{ padding: '6px 0' }}>
                    <span className={`badge risk-${k}`}>
                      {t(`riskLevel.${k}`)}
                    </span>
                    <span className="badge">{v}</span>
                  </div>
                ))
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
