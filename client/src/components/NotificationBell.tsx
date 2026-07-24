import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { api } from '../api/client';
import { AppNotification } from '../types';

export function NotificationBell() {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const qc = useQueryClient();

  const { data: count } = useQuery({
    queryKey: ['notif-count'],
    queryFn: async () =>
      (await api.get<{ count: number }>('/notifications/unread-count')).data,
    refetchInterval: 20000,
  });

  const { data: list } = useQuery({
    queryKey: ['notifications'],
    queryFn: async () =>
      (await api.get<AppNotification[]>('/notifications')).data,
    enabled: open,
  });

  async function markAllRead() {
    await api.patch('/notifications/read-all');
    qc.invalidateQueries({ queryKey: ['notif-count'] });
    qc.invalidateQueries({ queryKey: ['notifications'] });
  }

  async function onClick(n: AppNotification) {
    if (!n.isRead) {
      await api.patch(`/notifications/${n.id}/read`);
      qc.invalidateQueries({ queryKey: ['notif-count'] });
      qc.invalidateQueries({ queryKey: ['notifications'] });
    }
    if (n.reportId) navigate(`/reports/${n.reportId}`);
    setOpen(false);
  }

  return (
    <div style={{ position: 'relative' }}>
      <div className="notif-bell" onClick={() => setOpen((o) => !o)}>
        🔔
        {count && count.count > 0 ? (
          <span className="notif-count">{count.count}</span>
        ) : null}
      </div>
      {open && (
        <div className="notif-dropdown">
          <div className="flex-between" style={{ padding: '12px 14px' }}>
            <strong>{t('notifications.title')}</strong>
            <button className="btn btn-ghost btn-sm" onClick={markAllRead}>
              {t('notifications.markAllRead')}
            </button>
          </div>
          {!list || list.length === 0 ? (
            <div className="notif-item muted">{t('notifications.empty')}</div>
          ) : (
            list.map((n) => (
              <div
                key={n.id}
                className={`notif-item ${n.isRead ? '' : 'unread'}`}
                onClick={() => onClick(n)}
              >
                <div className="notif-title">{n.title}</div>
                <div className="notif-msg">{n.message}</div>
                <div className="notif-time">
                  {new Date(n.createdAt).toLocaleString()}
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
