import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { api, errorMessage } from '../api/client';
import { BodyMap } from '../components/BodyMap';
import { PhotoUpload } from '../components/PhotoUpload';
import {
  ACCIDENT_TYPES,
  OUTCOME_SEVERITIES,
  PERSON_TYPES,
  INJURY_TYPES,
  INJURY_SEVERITIES,
  BodyInjury,
  Department,
} from '../types';

export function AccidentFormPage() {
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
    accidentType: 'SLIP_TRIP_FALL',
    otherAccidentType: '',
    outcomeSeverity: 'FIRST_AID',
    isInjured: true,
    injuredName: '',
    injuredType: 'EMPLOYEE',
    otherInjuredType: '',
  });
  const [attachments, setAttachments] = useState<string[]>([]);
  const [injuries, setInjuries] = useState<BodyInjury[]>([]);
  const [selected, setSelected] = useState<{
    bodyPart: string;
    side: string;
    view: string;
  } | null>(null);
  const [injuryType, setInjuryType] = useState('BRUISE');
  const [otherInjuryType, setOtherInjuryType] = useState('');
  const [injurySeverity, setInjurySeverity] = useState('MINOR');
  const [injuryNote, setInjuryNote] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  function set(k: string, v: any) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  function addInjury() {
    if (!selected) return;
    setInjuries((prev) => [
      ...prev.filter(
        (i) =>
          !(
            i.bodyPart === selected.bodyPart &&
            i.side === selected.side &&
            i.view === selected.view
          ),
      ),
      {
        bodyPart: selected.bodyPart,
        side: selected.side,
        view: selected.view,
        type: injuryType,
        otherType: injuryType === 'OTHER' ? otherInjuryType || undefined : undefined,
        severity: injurySeverity,
        note: injuryNote || undefined,
      },
    ]);
    setInjuryNote('');
    setOtherInjuryType('');
    setSelected(null);
  }

  function removeInjury(idx: number) {
    setInjuries((prev) => prev.filter((_, i) => i !== idx));
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      const payload = {
        ...form,
        departmentId: form.departmentId || undefined,
        occurredAt: new Date(form.occurredAt).toISOString(),
        otherAccidentType:
          form.accidentType === 'OTHER' ? form.otherAccidentType : undefined,
        injuredName: form.isInjured ? form.injuredName : undefined,
        injuredType: form.isInjured ? form.injuredType : undefined,
        otherInjuredType:
          form.isInjured && form.injuredType === 'OTHER'
            ? form.otherInjuredType
            : undefined,
        bodyInjuries: form.isInjured ? injuries : [],
        attachments,
      };
      const { data } = await api.post('/reports/accident', payload);
      navigate(`/reports/${data.id}`);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <h1>🚑 {t('accidentForm.title')}</h1>
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
              placeholder="Ör. Üretim hattı 3, pres bölümü"
            />
          </div>
          <div className="row">
            <div className="field">
              <label>{t('accidentForm.accidentType')} *</label>
              <select
                value={form.accidentType}
                onChange={(e) => set('accidentType', e.target.value)}
              >
                {ACCIDENT_TYPES.map((a) => (
                  <option key={a} value={a}>
                    {t(`accidentType.${a}`)}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label>{t('accidentForm.outcome')} *</label>
              <select
                value={form.outcomeSeverity}
                onChange={(e) => set('outcomeSeverity', e.target.value)}
              >
                {OUTCOME_SEVERITIES.map((o) => (
                  <option key={o} value={o}>
                    {t(`outcomeSeverity.${o}`)}
                  </option>
                ))}
              </select>
            </div>
          </div>
          {form.accidentType === 'OTHER' && (
            <div className="field">
              <label>{t('accidentForm.otherSpecify')} *</label>
              <input
                value={form.otherAccidentType}
                onChange={(e) => set('otherAccidentType', e.target.value)}
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
              placeholder="Olayın nasıl gerçekleştiğini açıklayın..."
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

        <div className="card">
          <div className="flex-between">
            <div className="card-title" style={{ margin: 0 }}>
              {t('accidentForm.isInjured')}
            </div>
            <label className="checkbox-item" style={{ border: 'none' }}>
              <input
                type="checkbox"
                checked={form.isInjured}
                onChange={(e) => set('isInjured', e.target.checked)}
              />
              {form.isInjured ? t('common.yes') : t('common.no')}
            </label>
          </div>

          {form.isInjured && (
            <>
              <div className="row mt-8">
                <div className="field">
                  <label>{t('accidentForm.injuredName')}</label>
                  <input
                    value={form.injuredName}
                    onChange={(e) => set('injuredName', e.target.value)}
                  />
                </div>
                <div className="field">
                  <label>{t('accidentForm.injuredType')}</label>
                  <select
                    value={form.injuredType}
                    onChange={(e) => set('injuredType', e.target.value)}
                  >
                    {PERSON_TYPES.map((p) => (
                      <option key={p} value={p}>
                        {t(`personType.${p}`)}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {form.injuredType === 'OTHER' && (
                <div className="field">
                  <label>{t('accidentForm.otherSpecify')} *</label>
                  <input
                    value={form.otherInjuredType}
                    onChange={(e) => set('otherInjuredType', e.target.value)}
                    required
                  />
                </div>
              )}

              <div className="card-title mt-16">
                {t('accidentForm.bodyMapTitle')}
              </div>
              <p className="muted" style={{ fontSize: 13 }}>
                {t('accidentForm.bodyMapHelp')}
              </p>

              <div className="bodymap-layout">
                <div>
                  <BodyMap
                    injuries={injuries}
                    selected={selected}
                    onSelect={setSelected}
                  />
                </div>

                <div>
                  <div className="card" style={{ background: '#f8fafc' }}>
                    <div className="field">
                      <label>{t('accidentForm.injuryType')}</label>
                      <select
                        value={injuryType}
                        onChange={(e) => setInjuryType(e.target.value)}
                        disabled={!selected}
                      >
                        {INJURY_TYPES.map((i) => (
                          <option key={i} value={i}>
                            {t(`injuryType.${i}`)}
                          </option>
                        ))}
                      </select>
                    </div>
                    {injuryType === 'OTHER' && (
                      <div className="field">
                        <label>{t('accidentForm.otherSpecify')}</label>
                        <input
                          value={otherInjuryType}
                          onChange={(e) => setOtherInjuryType(e.target.value)}
                          disabled={!selected}
                        />
                      </div>
                    )}
                    <div className="field">
                      <label>{t('accidentForm.severity')}</label>
                      <select
                        value={injurySeverity}
                        onChange={(e) => setInjurySeverity(e.target.value)}
                        disabled={!selected}
                      >
                        {INJURY_SEVERITIES.map((s) => (
                          <option key={s} value={s}>
                            {t(`injurySeverity.${s}`)}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="field">
                      <label>{t('accidentForm.note')}</label>
                      <input
                        value={injuryNote}
                        onChange={(e) => setInjuryNote(e.target.value)}
                        disabled={!selected}
                      />
                    </div>
                    <button
                      type="button"
                      className="btn w-full"
                      disabled={!selected}
                      onClick={addInjury}
                    >
                      + {t('accidentForm.addInjury')}
                    </button>
                  </div>

                  <div className="card-title mt-16">
                    {t('accidentForm.addedInjuries')} ({injuries.length})
                  </div>
                  {injuries.length === 0 ? (
                    <div className="muted">{t('common.noData')}</div>
                  ) : (
                    <table>
                      <tbody>
                        {injuries.map((inj, idx) => (
                          <tr key={idx}>
                            <td>
                              <strong>
                                {t(`bodyPart.${inj.bodyPart}`)}
                              </strong>
                              {inj.side !== 'CENTER' &&
                                ` (${t(`bodySide.${inj.side}`)})`}
                              <div className="muted" style={{ fontSize: 11 }}>
                                {t(`bodyView.${inj.view}`)}
                              </div>
                            </td>
                            <td>{t(`injuryType.${inj.type}`)}</td>
                            <td>
                              <span className={`badge sev-${inj.severity}`}>
                                {t(`injurySeverity.${inj.severity}`)}
                              </span>
                            </td>
                            <td>
                              <button
                                type="button"
                                className="btn btn-ghost btn-sm"
                                onClick={() => removeInjury(idx)}
                              >
                                ✕
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>
            </>
          )}
        </div>

        <button className="btn btn-success" disabled={busy}>
          {busy ? t('common.loading') : t('accidentForm.submit')}
        </button>
      </form>
    </div>
  );
}
