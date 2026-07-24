import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { api, errorMessage } from '../api/client';
import { useAuth } from '../auth/AuthContext';
import {
  hasPermission,
  AdminUser,
  Role,
  Department,
  RANKS,
} from '../types';

export function AdminUsersPage() {
  const { t } = useTranslation();
  const { me } = useAuth();
  const qc = useQueryClient();
  const [tab, setTab] = useState<'PENDING' | 'ALL'>('PENDING');
  const [editing, setEditing] = useState<AdminUser | null>(null);
  const [error, setError] = useState('');

  const canApprove = hasPermission(me, 'USER_APPROVE');
  const canManage = hasPermission(me, 'USER_MANAGE');

  const { data: users } = useQuery({
    queryKey: ['admin-users', tab],
    queryFn: async () =>
      (
        await api.get<AdminUser[]>('/users', {
          params: tab === 'PENDING' ? { status: 'PENDING' } : {},
        })
      ).data,
  });

  const { data: roles } = useQuery({
    queryKey: ['roles'],
    queryFn: async () => (await api.get<Role[]>('/roles')).data,
  });

  const { data: departments } = useQuery({
    queryKey: ['departments'],
    queryFn: async () => (await api.get<Department[]>('/departments')).data,
  });

  function refresh() {
    qc.invalidateQueries({ queryKey: ['admin-users'] });
  }

  async function reject(id: string) {
    try {
      await api.post(`/users/${id}/reject`, {});
      refresh();
    } catch (e) {
      setError(errorMessage(e));
    }
  }

  async function suspend(id: string) {
    await api.post(`/users/${id}/suspend`, {});
    refresh();
  }

  async function reactivate(id: string) {
    await api.post(`/users/${id}/reactivate`, {});
    refresh();
  }

  return (
    <div>
      <h1>{t('nav.users')}</h1>
      {error && <div className="alert alert-error">{error}</div>}

      <div className="flex gap-8" style={{ marginBottom: 16 }}>
        <button
          className={`btn btn-sm ${tab === 'PENDING' ? '' : 'btn-secondary'}`}
          onClick={() => setTab('PENDING')}
        >
          {t('admin.pendingUsers')}
        </button>
        <button
          className={`btn btn-sm ${tab === 'ALL' ? '' : 'btn-secondary'}`}
          onClick={() => setTab('ALL')}
        >
          {t('admin.allUsers')}
        </button>
      </div>

      <div className="card">
        {!users || users.length === 0 ? (
          <div className="muted">{t('common.noData')}</div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>{t('auth.firstName')}</th>
                <th>{t('auth.email')}</th>
                <th>{t('reports.status')}</th>
                <th>{t('admin.role')}</th>
                <th>{t('admin.rank')}</th>
                <th>{t('common.actions')}</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id}>
                  <td>
                    {u.firstName} {u.lastName}
                    {u.isSuperAdmin && (
                      <span className="badge badge-primary" style={{ marginLeft: 6 }}>
                        Super
                      </span>
                    )}
                  </td>
                  <td>{u.email}</td>
                  <td>
                    <span
                      className={`badge ${
                        u.status === 'VERIFIED'
                          ? 'badge-success'
                          : u.status === 'PENDING'
                            ? 'badge-warning'
                            : 'badge-danger'
                      }`}
                    >
                      {t(`status.${u.status}`)}
                    </span>
                  </td>
                  <td>{u.role?.name || '—'}</td>
                  <td>{u.rank ? t(`rank.${u.rank}`) : '—'}</td>
                  <td>
                    <div className="flex gap-8">
                      {u.status === 'PENDING' && canApprove && (
                        <>
                          <button
                            className="btn btn-success btn-sm"
                            onClick={() => setEditing(u)}
                          >
                            {t('admin.approve')}
                          </button>
                          <button
                            className="btn btn-danger btn-sm"
                            onClick={() => reject(u.id)}
                          >
                            {t('admin.reject')}
                          </button>
                        </>
                      )}
                      {u.status === 'VERIFIED' && !u.isSuperAdmin && canManage && (
                        <>
                          <button
                            className="btn btn-secondary btn-sm"
                            onClick={() => setEditing(u)}
                          >
                            {t('admin.updateAuthorization')}
                          </button>
                          <button
                            className="btn btn-ghost btn-sm"
                            onClick={() => suspend(u.id)}
                          >
                            {t('admin.suspend')}
                          </button>
                        </>
                      )}
                      {u.status === 'SUSPENDED' && canManage && (
                        <button
                          className="btn btn-success btn-sm"
                          onClick={() => reactivate(u.id)}
                        >
                          {t('admin.reactivate')}
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {editing && (
        <AuthorizeModal
          user={editing}
          roles={roles || []}
          departments={departments || []}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            refresh();
          }}
        />
      )}
    </div>
  );
}

function AuthorizeModal({
  user,
  roles,
  departments,
  onClose,
  onSaved,
}: {
  user: AdminUser;
  roles: Role[];
  departments: Department[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const { t } = useTranslation();
  const isPending = user.status === 'PENDING';
  const [roleId, setRoleId] = useState(user.role?.id || '');
  const [rank, setRank] = useState(user.rank || '');
  const [deptIds, setDeptIds] = useState<string[]>(
    user.departments.map((d) => d.id),
  );
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  function toggleDept(id: string) {
    setDeptIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  }

  async function save() {
    setBusy(true);
    setError('');
    try {
      const payload = {
        roleId: roleId || null,
        rank: rank || null,
        departmentIds: deptIds,
      };
      if (isPending) {
        await api.post(`/users/${user.id}/approve`, {
          roleId: roleId || undefined,
          rank: rank || undefined,
          departmentIds: deptIds,
        });
      } else {
        await api.patch(`/users/${user.id}/authorization`, payload);
      }
      onSaved();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 50,
        padding: 20,
      }}
      onClick={onClose}
    >
      <div
        className="card"
        style={{ maxWidth: 560, width: '100%', maxHeight: '90vh', overflowY: 'auto' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="card-title">
          {isPending ? t('admin.approveTitle') : t('admin.updateAuthorization')}
        </div>
        <p className="muted">
          {user.firstName} {user.lastName} — {user.email}
        </p>
        {error && <div className="alert alert-error">{error}</div>}

        <div className="field">
          <label>{t('admin.role')}</label>
          <select value={roleId} onChange={(e) => setRoleId(e.target.value)}>
            <option value="">{t('admin.noRole')}</option>
            {roles.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </select>
        </div>

        <div className="field">
          <label>{t('admin.rank')}</label>
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
          <label>{t('admin.departments')}</label>
          <div className="checkbox-grid">
            {departments.map((d) => (
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
          <button className="btn btn-success" onClick={save} disabled={busy}>
            {isPending ? t('admin.approve') : t('common.save')}
          </button>
          <button className="btn btn-secondary" onClick={onClose}>
            {t('common.cancel')}
          </button>
        </div>
      </div>
    </div>
  );
}
