import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { api, errorMessage } from '../api/client';
import { Role, Permission } from '../types';

export function AdminRolesPage() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [editing, setEditing] = useState<Partial<Role> | null>(null);
  const [error, setError] = useState('');

  const { data: roles } = useQuery({
    queryKey: ['roles'],
    queryFn: async () => (await api.get<Role[]>('/roles')).data,
  });

  const { data: allPermissions } = useQuery({
    queryKey: ['permissions'],
    queryFn: async () =>
      (await api.get<Permission[]>('/roles/permissions')).data,
  });

  function refresh() {
    qc.invalidateQueries({ queryKey: ['roles'] });
  }

  async function remove(id: string) {
    try {
      await api.delete(`/roles/${id}`);
      refresh();
    } catch (e) {
      setError(errorMessage(e));
    }
  }

  return (
    <div>
      <div className="flex-between">
        <h1>{t('nav.roles')}</h1>
        <button
          className="btn"
          onClick={() =>
            setEditing({ name: '', description: '', permissions: [] })
          }
        >
          + {t('admin.newRole')}
        </button>
      </div>
      {error && <div className="alert alert-error">{error}</div>}

      <div className="card">
        <table>
          <thead>
            <tr>
              <th>{t('admin.roleName')}</th>
              <th>{t('admin.permissions')}</th>
              <th>{t('admin.members')}</th>
              <th>{t('common.actions')}</th>
            </tr>
          </thead>
          <tbody>
            {roles?.map((r) => (
              <tr key={r.id}>
                <td>
                  <strong>{r.name}</strong>
                  {r.isSystem && (
                    <span className="badge" style={{ marginLeft: 6 }}>
                      sistem
                    </span>
                  )}
                  <div className="muted" style={{ fontSize: 12 }}>
                    {r.description}
                  </div>
                </td>
                <td>
                  <span className="badge badge-info">
                    {r.permissions.length}
                  </span>
                </td>
                <td>{r._count?.users ?? 0}</td>
                <td>
                  <div className="flex gap-8">
                    <button
                      className="btn btn-secondary btn-sm"
                      onClick={() => setEditing(r)}
                    >
                      {t('common.edit')}
                    </button>
                    {!r.isSystem && (
                      <button
                        className="btn btn-danger btn-sm"
                        onClick={() => remove(r.id)}
                      >
                        {t('common.delete')}
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {editing && (
        <RoleModal
          role={editing}
          allPermissions={allPermissions || []}
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

function RoleModal({
  role,
  allPermissions,
  onClose,
  onSaved,
}: {
  role: Partial<Role>;
  allPermissions: Permission[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const { t } = useTranslation();
  const [name, setName] = useState(role.name || '');
  const [description, setDescription] = useState(role.description || '');
  const [perms, setPerms] = useState<Permission[]>(role.permissions || []);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  function toggle(p: Permission) {
    setPerms((prev) =>
      prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p],
    );
  }

  async function save() {
    setBusy(true);
    setError('');
    try {
      const payload = { name, description, permissions: perms };
      if (role.id) {
        await api.patch(`/roles/${role.id}`, payload);
      } else {
        await api.post('/roles', payload);
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
        style={{ maxWidth: 640, width: '100%', maxHeight: '90vh', overflowY: 'auto' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="card-title">
          {role.id ? t('common.edit') : t('admin.newRole')}
        </div>
        {error && <div className="alert alert-error">{error}</div>}
        <div className="field">
          <label>{t('admin.roleName')} *</label>
          <input value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="field">
          <label>{t('reports.description')}</label>
          <input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>
        <div className="field">
          <label>{t('admin.permissions')}</label>
          <div className="checkbox-grid">
            {allPermissions.map((p) => (
              <label key={p} className="checkbox-item">
                <input
                  type="checkbox"
                  checked={perms.includes(p)}
                  onChange={() => toggle(p)}
                />
                {t(`permission.${p}`)}
              </label>
            ))}
          </div>
        </div>
        <div className="flex gap-8 mt-16">
          <button className="btn" onClick={save} disabled={busy || !name}>
            {t('common.save')}
          </button>
          <button className="btn btn-secondary" onClick={onClose}>
            {t('common.cancel')}
          </button>
        </div>
      </div>
    </div>
  );
}
