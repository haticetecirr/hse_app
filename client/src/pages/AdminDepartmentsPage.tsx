import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { api, errorMessage } from '../api/client';
import { Department } from '../types';

export function AdminDepartmentsPage() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [form, setForm] = useState({ name: '', code: '', description: '' });
  const [error, setError] = useState('');

  const { data: departments } = useQuery({
    queryKey: ['departments'],
    queryFn: async () => (await api.get<Department[]>('/departments')).data,
  });

  function refresh() {
    qc.invalidateQueries({ queryKey: ['departments'] });
  }

  async function create() {
    if (!form.name) return;
    if (form.code && form.code.length !== 3) {
      setError(t('admin.codeLengthError'));
      return;
    }
    setError('');
    try {
      await api.post('/departments', {
        name: form.name,
        code: form.code || undefined,
        description: form.description || undefined,
      });
      setForm({ name: '', code: '', description: '' });
      refresh();
    } catch (e) {
      setError(errorMessage(e));
    }
  }

  async function remove(id: string) {
    try {
      await api.delete(`/departments/${id}`);
      refresh();
    } catch (e) {
      setError(errorMessage(e));
    }
  }

  return (
    <div>
      <h1>{t('nav.departments')}</h1>
      {error && <div className="alert alert-error">{error}</div>}

      <div className="card">
        <div className="card-title">{t('admin.newDepartment')}</div>
        <div className="row">
          <div className="field">
            <label>{t('admin.departmentName')} *</label>
            <input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </div>
          <div className="field">
            <label>{t('admin.departmentCode')}</label>
            <input
              value={form.code}
              maxLength={3}
              placeholder={t('admin.codeHint')}
              onChange={(e) => setForm({ ...form, code: e.target.value })}
            />
          </div>
          <div className="field">
            <label>{t('reports.description')}</label>
            <input
              value={form.description}
              onChange={(e) =>
                setForm({ ...form, description: e.target.value })
              }
            />
          </div>
          <button
            className="btn"
            onClick={create}
            style={{ alignSelf: 'flex-end', marginBottom: 14 }}
          >
            + {t('common.create')}
          </button>
        </div>
      </div>

      <div className="card">
        <table>
          <thead>
            <tr>
              <th>{t('admin.departmentName')}</th>
              <th>{t('admin.departmentCode')}</th>
              <th>{t('admin.members')}</th>
              <th>{t('reports.listTitle')}</th>
              <th>{t('common.actions')}</th>
            </tr>
          </thead>
          <tbody>
            {departments?.map((d) => (
              <tr key={d.id}>
                <td>
                  <strong>{d.name}</strong>
                  <div className="muted" style={{ fontSize: 12 }}>
                    {d.description}
                  </div>
                </td>
                <td>{d.code || '—'}</td>
                <td>{d._count?.members ?? 0}</td>
                <td>{d._count?.reports ?? 0}</td>
                <td>
                  <button
                    className="btn btn-danger btn-sm"
                    onClick={() => remove(d.id)}
                  >
                    {t('common.delete')}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
