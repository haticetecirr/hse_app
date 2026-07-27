import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { api, errorMessage } from '../api/client';
import { riskLevel } from '../components/RiskMatrix';
import { PhotoUpload } from '../components/PhotoUpload';
import {
  NEAR_MISS_CATEGORIES,
  HAZARD_CATEGORIES,
  Department,
} from '../types';

export function NearMissFormPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const { data: departments } = useQuery({
    queryKey: ['departments'],
    queryFn: async () => (await api.get<Department[]>('/departments')).data,
  });

  const [form, setForm] = useState({
    departmentId: '',
    occurredAt: '',
    location: '',
    description: '',
    witnesses: '',
    nearMissCategory: 'UNSAFE_CONDITION',
    hazardCategory: 'SLIPS_TRIPS_FALLS',
    otherHazard: '',
    severityScore: 3,
    likelihoodScore: 3,
    rootCause: '',
    immediateAction: '',
  });
  const [attachments, setAttachments] = useState<string[]>([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  function set(k: string, v: any) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  const score = form.severityScore * form.likelihoodScore;
  const level = riskLevel(score);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      const payload = {
        ...form,
        departmentId: form.departmentId || undefined,
        occurredAt: new Date(form.occurredAt).toISOString(),
        otherHazard:
          form.hazardCategory === 'OTHER' ? form.otherHazard : undefined,
        attachments,
      };
      const { data } = await api.post('/reports/near-miss', payload);
      navigate(`/reports/${data.id}`);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <h1>⚠️ {t('nearMissForm.title')}</h1>
      {error && <div className="alert alert-error">{error}</div>}

      <form onSubmit={onSubmit}>
        <div className="card">
          <div className="card-title">{t('reports.description')}</div>
          <div className="row">
            <div className="field">
              <label>{t('reports.department')}</label>
              <select
                value={form.departmentId}
                onChange={(e) => set('departmentId', e.target.value)}
              >
                <option value="">{t('common.none')}</option>
                {departments?.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label>{t('reports.occurredAt')} *</label>
              <input
                type="datetime-local"
                value={form.occurredAt}
                onChange={(e) => set('occurredAt', e.target.value)}
                required
              />
            </div>
          </div>
          <div className="field">
            <label>{t('reports.location')} *</label>
            <input
              value={form.location}
              onChange={(e) => set('location', e.target.value)}
              required
            />
          </div>
          <div className="row">
            <div className="field">
              <label>{t('nearMissForm.category')} *</label>
              <select
                value={form.nearMissCategory}
                onChange={(e) => set('nearMissCategory', e.target.value)}
              >
                {NEAR_MISS_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {t(`nearMissCategory.${c}`)}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label>{t('nearMissForm.hazard')} *</label>
              <select
                value={form.hazardCategory}
                onChange={(e) => set('hazardCategory', e.target.value)}
              >
                {HAZARD_CATEGORIES.map((h) => (
                  <option key={h} value={h}>
                    {t(`hazardCategory.${h}`)}
                  </option>
                ))}
              </select>
            </div>
          </div>
          {form.hazardCategory === 'OTHER' && (
            <div className="field">
              <label>{t('accidentForm.otherSpecify')} *</label>
              <input
                value={form.otherHazard}
                onChange={(e) => set('otherHazard', e.target.value)}
                required
              />
            </div>
          )}
          <div className="field">
            <label>{t('reports.description')} *</label>
            <textarea
              value={form.description}
              onChange={(e) => set('description', e.target.value)}
              required
              minLength={10}
            />
          </div>
        </div>

        <div className="card">
          <div className="card-title">{t('nearMissForm.riskAssessment')}</div>
          <div className="row">
            <div className="field">
              <label>{t('nearMissForm.severity')}</label>
              <select
                value={form.severityScore}
                onChange={(e) => set('severityScore', +e.target.value)}
              >
                {[1, 2, 3, 4, 5].map((n) => (
                  <option key={n} value={n}>
                    {n} — {t(`nearMissForm.severityHelp.${n}`)}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label>{t('nearMissForm.likelihood')}</label>
              <select
                value={form.likelihoodScore}
                onChange={(e) => set('likelihoodScore', +e.target.value)}
              >
                {[1, 2, 3, 4, 5].map((n) => (
                  <option key={n} value={n}>
                    {n} — {t(`nearMissForm.likelihoodHelp.${n}`)}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="mt-16">
            <span className={`badge risk-${level}`} style={{ fontSize: 14 }}>
              {t('nearMissForm.riskResult')}: {score} — {t(`riskLevel.${level}`)}
            </span>
          </div>
        </div>

        <div className="card">
          <div className="field">
            <label>{t('nearMissForm.rootCause')}</label>
            <textarea
              value={form.rootCause}
              onChange={(e) => set('rootCause', e.target.value)}
              placeholder="5 Neden / kok neden analizi..."
            />
          </div>
          <div className="field">
            <label>{t('nearMissForm.immediateAction')}</label>
            <textarea
              value={form.immediateAction}
              onChange={(e) => set('immediateAction', e.target.value)}
            />
          </div>
          <div className="field">
            <label>{t('reports.witnesses')}</label>
            <input
              value={form.witnesses}
              onChange={(e) => set('witnesses', e.target.value)}
            />
          </div>
        </div>

        <div className="card">
          <div className="card-title">📷 {t('accidentForm.photos')}</div>
          <PhotoUpload value={attachments} onChange={setAttachments} />
        </div>

        <button className="btn btn-success" disabled={busy}>
          {busy ? t('common.loading') : t('nearMissForm.submit')}
        </button>
      </form>
    </div>
  );
}
