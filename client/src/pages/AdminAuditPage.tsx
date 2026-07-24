import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { api } from '../api/client';

interface AuditRow {
  id: string;
  actorName: string;
  action: string;
  entityType: string;
  entityId?: string;
  summary: string;
  ip?: string;
  createdAt: string;
}

// Islem turlerine gore renkli rozet
function actionBadge(action: string) {
  if (action.includes('DELETE') || action.includes('REJECT')) return 'badge-danger';
  if (action.includes('CREATE') || action.includes('APPROVE')) return 'badge-success';
  if (action.includes('STATUS') || action.includes('UPDATE') || action.includes('ASSIGN'))
    return 'badge-warning';
  if (action === 'LOGIN') return 'badge-info';
  return 'badge';
}

export function AdminAuditPage() {
  const { t } = useTranslation();
  const [action, setAction] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['audit', action],
    queryFn: async () =>
      (
        await api.get<AuditRow[]>('/audit', {
          params: action ? { action } : {},
        })
      ).data,
  });

  // Filtre icin mevcut islem turleri
  const actions = Array.from(new Set((data || []).map((d) => d.action))).sort();

  return (
    <div>
      <h1>{t('audit.title')}</h1>

      <div className="card">
        <div className="field" style={{ maxWidth: 320 }}>
          <label>{t('audit.filterAction')}</label>
          <select value={action} onChange={(e) => setAction(e.target.value)}>
            <option value="">{t('common.all')}</option>
            {actions.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="card">
        {isLoading ? (
          <div>{t('common.loading')}</div>
        ) : !data || data.length === 0 ? (
          <div className="muted">{t('audit.empty')}</div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>{t('audit.when')}</th>
                <th>{t('audit.actor')}</th>
                <th>{t('audit.action')}</th>
                <th>{t('audit.entity')}</th>
                <th>{t('audit.summary')}</th>
                <th>{t('audit.ip')}</th>
              </tr>
            </thead>
            <tbody>
              {data.map((row) => (
                <tr key={row.id}>
                  <td style={{ whiteSpace: 'nowrap' }}>
                    {new Date(row.createdAt).toLocaleString()}
                  </td>
                  <td>{row.actorName}</td>
                  <td>
                    <span className={`badge ${actionBadge(row.action)}`}>
                      {row.action}
                    </span>
                  </td>
                  <td className="muted">{row.entityType}</td>
                  <td>{row.summary}</td>
                  <td className="mono muted" style={{ fontSize: 11 }}>
                    {row.ip || '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
