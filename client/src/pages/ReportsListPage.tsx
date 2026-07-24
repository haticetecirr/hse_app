import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { api } from '../api/client';
import { Report, REPORT_STATUSES } from '../types';

function statusBadge(status: string) {
  const map: Record<string, string> = {
    SUBMITTED: 'badge-info',
    UNDER_REVIEW: 'badge-info',
    INVESTIGATING: 'badge-warning',
    ACTIONS_PENDING: 'badge-warning',
    CLOSED: 'badge-success',
    REJECTED: 'badge-danger',
    DRAFT: 'badge',
  };
  return map[status] || 'badge';
}

export function ReportsListPage() {
  const { t } = useTranslation();
  const [type, setType] = useState('');
  const [status, setStatus] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['reports', type, status],
    queryFn: async () => {
      const params: any = {};
      if (type) params.type = type;
      if (status) params.status = status;
      return (await api.get<Report[]>('/reports', { params })).data;
    },
  });

  return (
    <div>
      <h1>{t('reports.listTitle')}</h1>

      <div className="card">
        <div className="row">
          <div className="field">
            <label>{t('reports.type')}</label>
            <select value={type} onChange={(e) => setType(e.target.value)}>
              <option value="">{t('common.all')}</option>
              <option value="ACCIDENT">{t('reportType.ACCIDENT')}</option>
              <option value="NEAR_MISS">{t('reportType.NEAR_MISS')}</option>
            </select>
          </div>
          <div className="field">
            <label>{t('reports.status')}</label>
            <select value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="">{t('common.all')}</option>
              {REPORT_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {t(`reportStatus.${s}`)}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div className="card">
        {isLoading ? (
          <div>{t('common.loading')}</div>
        ) : !data || data.length === 0 ? (
          <div className="muted">{t('reports.noReports')}</div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>{t('reports.referenceNo')}</th>
                <th>{t('reports.type')}</th>
                <th>{t('reports.status')}</th>
                <th>{t('reports.location')}</th>
                <th>{t('reports.reporter')}</th>
                <th>{t('reports.occurredAt')}</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {data.map((r) => (
                <tr key={r.id}>
                  <td className="mono">{r.referenceNo}</td>
                  <td>
                    <span
                      className={`badge ${
                        r.type === 'ACCIDENT' ? 'badge-danger' : 'badge-warning'
                      }`}
                    >
                      {t(`reportType.${r.type}`)}
                    </span>
                  </td>
                  <td>
                    <span className={`badge ${statusBadge(r.status)}`}>
                      {t(`reportStatus.${r.status}`)}
                    </span>
                  </td>
                  <td>{r.location}</td>
                  <td>
                    {r.reporter.firstName} {r.reporter.lastName}
                  </td>
                  <td>{new Date(r.occurredAt).toLocaleDateString()}</td>
                  <td>
                    <Link to={`/reports/${r.id}`} className="btn btn-sm btn-secondary">
                      {t('reports.viewDetail')}
                    </Link>
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
