import { ReactNode, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { api, errorMessage } from '../api/client';
import { useAuth } from '../auth/AuthContext';
import { AdminUser, Department, RANKS, Role, hasPermission } from '../types';

type Mode = 'detail' | 'confirmApprove' | 'reject' | 'done';

// Detay satiri (rapor detay sayfasindaki gorunumle ayni)
function Row({ label, value }: { label: string; value: ReactNode }) {
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

// "Yeni hesap onayi bekliyor" bildiriminden acilan kullanici onay modali.
// Detaylari gosterir; ADMIN (USER_APPROVE izni) onaylayabilir/reddedebilir.
export function UserApprovalModal({
  userId,
  onClose,
  onResolved,
}: {
  userId: string;
  onClose: () => void;
  // Onay/red basarili olunca cagrilir (bildirim + listeler tazelenir)
  onResolved: () => void;
}) {
  const { t } = useTranslation();
  const { me } = useAuth();
  const qc = useQueryClient();

  const [mode, setMode] = useState<Mode>('detail');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [busy, setBusy] = useState(false);
  const [reason, setReason] = useState('');

  // Onay sirasinda istege bagli ilk yetkilendirme
  const [roleId, setRoleId] = useState('');
  const [rank, setRank] = useState('');
  const [deptIds, setDeptIds] = useState<string[]>([]);

  const canApprove = hasPermission(me, 'USER_APPROVE');

  const {
    data: user,
    isLoading,
    error: loadError,
  } = useQuery({
    queryKey: ['user-detail', userId],
    queryFn: async () => (await api.get<AdminUser>(`/users/${userId}`)).data,
  });

  const { data: roles } = useQuery({
    queryKey: ['roles'],
    queryFn: async () => (await api.get<Role[]>('/roles')).data,
    enabled: canApprove,
  });

  const { data: departments } = useQuery({
    queryKey: ['departments'],
    queryFn: async () => (await api.get<Department[]>('/departments')).data,
    enabled: canApprove,
  });

  function toggleDept(id: string) {
    setDeptIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  }

  function refreshAll() {
    qc.invalidateQueries({ queryKey: ['admin-users'] });
    qc.invalidateQueries({ queryKey: ['user-detail', userId] });
    qc.invalidateQueries({ queryKey: ['notifications'] });
    qc.invalidateQueries({ queryKey: ['notif-count'] });
  }

  async function approve() {
    setBusy(true);
    setError('');
    try {
      await api.post(`/users/${userId}/approve`, {
        roleId: roleId || undefined,
        rank: rank || undefined,
        departmentIds: deptIds.length > 0 ? deptIds : undefined,
      });
      setSuccess(t('approval.approveSuccess'));
      setMode('done');
      refreshAll();
      onResolved();
    } catch (e) {
      setError(errorMessage(e));
      setMode('detail');
    } finally {
      setBusy(false);
    }
  }

  async function reject() {
    setBusy(true);
    setError('');
    try {
      await api.post(`/users/${userId}/reject`, {
        reason: reason.trim() || undefined,
      });
      setSuccess(t('approval.rejectSuccess'));
      setMode('done');
      refreshAll();
      onResolved();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  const isPending = user?.status === 'PENDING';

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 60,
        padding: 20,
      }}
      onClick={onClose}
    >
      <div
        className="card"
        style={{
          maxWidth: 560,
          width: '100%',
          maxHeight: '90vh',
          overflowY: 'auto',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="card-title">{t('approval.title')}</div>

        {isLoading && <div className="muted">{t('common.loading')}</div>}
        {loadError && (
          <div className="alert alert-error">{errorMessage(loadError)}</div>
        )}
        {error && <div className="alert alert-error">{error}</div>}
        {success && <div className="alert alert-success">{success}</div>}

        {user && (
          <>
            <div>
              <Row label={t('auth.firstName')} value={user.firstName} />
              <Row label={t('auth.lastName')} value={user.lastName} />
              <Row label={t('auth.email')} value={user.email} />
              <Row
                label={t('admin.departments')}
                value={
                  user.departments.length > 0
                    ? user.departments.map((d) => d.name).join(', ')
                    : '—'
                }
              />
              <Row label={t('admin.role')} value={user.role?.name || '—'} />
              <Row
                label={t('approval.registeredAt')}
                value={new Date(user.createdAt).toLocaleString('tr-TR')}
              />
              <Row
                label={t('approval.currentStatus')}
                value={
                  <span
                    className={`badge ${
                      user.status === 'VERIFIED'
                        ? 'badge-success'
                        : user.status === 'PENDING'
                          ? 'badge-warning'
                          : 'badge-danger'
                    }`}
                  >
                    {t(`status.${user.status}`)}
                  </span>
                }
              />
            </div>

            {/* Zaten sonuclanmis kayitlar icin uyari (tekrar onay engellenir) */}
            {!isPending && mode !== 'done' && (
              <div className="alert alert-info mt-16">
                {user.status === 'VERIFIED'
                  ? t('approval.alreadyApproved')
                  : user.status === 'REJECTED'
                    ? t('approval.alreadyRejected')
                    : t('approval.notPending')}
              </div>
            )}

            {isPending && !canApprove && mode !== 'done' && (
              <div className="alert alert-info mt-16">
                {t('approval.noPermission')}
              </div>
            )}

            {/* 1) Onay penceresi */}
            {mode === 'confirmApprove' && (
              <div className="card mt-16" style={{ background: '#f8fafc' }}>
                <strong>{t('approval.confirmApprove')}</strong>

                <div className="field mt-16">
                  <label>
                    {t('admin.role')} ({t('approval.optional')})
                  </label>
                  <select
                    value={roleId}
                    onChange={(e) => setRoleId(e.target.value)}
                  >
                    <option value="">{t('admin.noRole')}</option>
                    {(roles || []).map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="field">
                  <label>
                    {t('admin.rank')} ({t('approval.optional')})
                  </label>
                  <select value={rank} onChange={(e) => setRank(e.target.value)}>
                    <option value="">{t('admin.noRank')}</option>
                    {RANKS.map((r) => (
                      <option key={r} value={r}>
                        {t(`rank.${r}`)}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="field">
                  <label>
                    {t('admin.departments')} ({t('approval.optional')})
                  </label>
                  <div className="checkbox-grid">
                    {(departments || []).map((d) => (
                      <label key={d.id} className="checkbox-item">
                        <input
                          type="checkbox"
                          checked={deptIds.includes(d.id)}
                          onChange={() => toggleDept(d.id)}
                        />
                        {d.name}
                      </label>
                    ))}
                  </div>
                </div>

                <div className="flex gap-8 mt-16">
                  <button
                    className="btn btn-success"
                    onClick={approve}
                    disabled={busy}
                  >
                    {t('approval.yesApprove')}
                  </button>
                  <button
                    className="btn btn-secondary"
                    onClick={() => setMode('detail')}
                    disabled={busy}
                  >
                    {t('common.cancel')}
                  </button>
                </div>
              </div>
            )}

            {/* 2) Reddetme nedeni */}
            {mode === 'reject' && (
              <div className="card mt-16" style={{ background: '#f8fafc' }}>
                <strong>{t('approval.rejectTitle')}</strong>
                <div className="field mt-16">
                  <label>{t('approval.rejectReason')}</label>
                  <textarea
                    rows={3}
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    placeholder={t('approval.rejectReasonHint')}
                  />
                </div>
                <div className="flex gap-8">
                  <button
                    className="btn btn-danger"
                    onClick={reject}
                    disabled={busy}
                  >
                    {t('approval.confirmReject')}
                  </button>
                  <button
                    className="btn btn-secondary"
                    onClick={() => setMode('detail')}
                    disabled={busy}
                  >
                    {t('common.cancel')}
                  </button>
                </div>
              </div>
            )}

            {/* 3) Ana butonlar */}
            {mode === 'detail' && (
              <div className="flex gap-8 mt-16">
                {isPending && canApprove && (
                  <>
                    <button
                      className="btn btn-success"
                      onClick={() => setMode('confirmApprove')}
                    >
                      {t('approval.approveAccount')}
                    </button>
                    <button
                      className="btn btn-danger"
                      onClick={() => setMode('reject')}
                    >
                      {t('admin.reject')}
                    </button>
                  </>
                )}
                <button className="btn btn-secondary" onClick={onClose}>
                  {t('common.cancel')}
                </button>
              </div>
            )}

            {mode === 'done' && (
              <div className="flex gap-8 mt-16">
                <button className="btn btn-secondary" onClick={onClose}>
                  {t('common.close')}
                </button>
              </div>
            )}
          </>
        )}

        {!user && !isLoading && (
          <div className="flex gap-8 mt-16">
            <button className="btn btn-secondary" onClick={onClose}>
              {t('common.close')}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
