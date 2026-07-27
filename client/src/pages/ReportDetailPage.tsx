import { useRef, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { api, errorMessage } from '../api/client';
import { useAuth } from '../auth/AuthContext';
import {
  hasPermission,
  isVideoUrl,
  Report,
  AdminUser,
  REPORT_STATUSES,
} from '../types';
import { PrintableReport } from '../components/PrintableReport';

function Row({ label, value }: { label: string; value?: React.ReactNode }) {
  if (value === undefined || value === null || value === '') return null;
  return (
    <div className="flex-between" style={{ padding: '6px 0', borderBottom: '1px solid #f1f5f9' }}>
      <span className="muted">{label}</span>
      <span style={{ fontWeight: 500, textAlign: 'right' }}>{value}</span>
    </div>
  );
}

export function ReportDetailPage() {
  const { t } = useTranslation();
  const { id } = useParams();
  const { me } = useAuth();
  const qc = useQueryClient();
  const [error, setError] = useState('');
  const printRef = useRef<HTMLDivElement>(null);
  const [pdfBusy, setPdfBusy] = useState(false);

  const { data: r, isLoading } = useQuery({
    queryKey: ['report', id],
    queryFn: async () => (await api.get<Report>(`/reports/${id}`)).data,
  });

  const canManage = hasPermission(
    me,
    'REPORT_INVESTIGATE',
    'REPORT_CLOSE',
    'REPORT_UPDATE',
  );
  const canAssign = hasPermission(me, 'REPORT_ASSIGN');
  const canAction = hasPermission(me, 'ACTION_MANAGE', 'REPORT_INVESTIGATE');

  const { data: users } = useQuery({
    queryKey: ['verified-users'],
    queryFn: async () =>
      (await api.get<AdminUser[]>('/users', { params: { status: 'VERIFIED' } }))
        .data,
    enabled: canAssign || canAction,
  });

  const [newStatus, setNewStatus] = useState('');
  const [assignee, setAssignee] = useState('');
  const [actionDesc, setActionDesc] = useState('');
  const [actionAssignee, setActionAssignee] = useState('');
  const [actionDue, setActionDue] = useState('');

  async function changeStatus() {
    if (!newStatus) return;
    try {
      await api.patch(`/reports/${id}/status`, { status: newStatus });
      qc.invalidateQueries({ queryKey: ['report', id] });
      setNewStatus('');
    } catch (e) {
      setError(errorMessage(e));
    }
  }

  async function assign() {
    if (!assignee) return;
    try {
      await api.post(`/reports/${id}/assign`, { assignedToId: assignee });
      qc.invalidateQueries({ queryKey: ['report', id] });
      setAssignee('');
    } catch (e) {
      setError(errorMessage(e));
    }
  }

  async function addAction() {
    if (!actionDesc) return;
    try {
      await api.post(`/reports/${id}/actions`, {
        description: actionDesc,
        assignedToId: actionAssignee || undefined,
        dueDate: actionDue ? new Date(actionDue).toISOString() : undefined,
      });
      qc.invalidateQueries({ queryKey: ['report', id] });
      setActionDesc('');
      setActionAssignee('');
      setActionDue('');
    } catch (e) {
      setError(errorMessage(e));
    }
  }

  async function updateActionStatus(actionId: string, status: string) {
    await api.patch(`/reports/actions/${actionId}`, { status });
    qc.invalidateQueries({ queryKey: ['report', id] });
  }

  async function downloadPdf() {
    if (!printRef.current || !r) return;
    setPdfBusy(true);
    try {
      const html2pdf = (await import('html2pdf.js')).default;
      await html2pdf()
        .set({
          margin: 8,
          filename: `${r.referenceNo}.pdf`,
          image: { type: 'jpeg', quality: 0.95 },
          html2canvas: { scale: 2, useCORS: true },
          jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
          pagebreak: {
            mode: ['css', 'legacy'],
            before: '.pdf-attachments-page',
            avoid: '.pdf-photo',
          },
        })
        .from(printRef.current)
        .save();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setPdfBusy(false);
    }
  }

  if (isLoading || !r) return <div className="card">{t('common.loading')}</div>;

  return (
    <div>
      <div className="flex-between">
        <h1>
          <span className="mono">{r.referenceNo}</span>{' '}
          <span
            className={`badge ${r.type === 'ACCIDENT' ? 'badge-danger' : 'badge-warning'}`}
          >
            {t(`reportType.${r.type}`)}
          </span>
        </h1>
        <div className="flex gap-8">
          <button
            className="btn btn-sm"
            onClick={downloadPdf}
            disabled={pdfBusy}
          >
            📄 {pdfBusy ? t('common.loading') : t('reports.downloadPdf')}
          </button>
          <Link to="/reports" className="btn btn-secondary btn-sm">
            ← {t('common.back')}
          </Link>
        </div>
      </div>

      {/* PDF icin gizli yazdirilabilir bolum */}
      <div style={{ position: 'fixed', left: -99999, top: 0 }} aria-hidden>
        <PrintableReport ref={printRef} report={r} />
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      <div className="row">
        <div style={{ flex: 2, minWidth: 320 }}>
          <div className="card">
            <div className="card-title">{t('common.details')}</div>
            <Row
              label={t('reports.status')}
              value={t(`reportStatus.${r.status}`)}
            />
            <Row label={t('reports.location')} value={r.location} />
            <Row
              label={t('reports.occurredAt')}
              value={new Date(r.occurredAt).toLocaleString()}
            />
            <Row
              label={t('reports.reporter')}
              value={`${r.reporter.firstName} ${r.reporter.lastName}`}
            />
            <Row label={t('reports.department')} value={r.department?.name} />
            <Row
              label={t('reports.assignedTo')}
              value={
                r.assignedTo
                  ? `${r.assignedTo.firstName} ${r.assignedTo.lastName}`
                  : undefined
              }
            />
            <Row label={t('reports.witnesses')} value={r.witnesses} />
            <div style={{ padding: '10px 0' }}>
              <div className="muted">{t('reports.description')}</div>
              <div>{r.description}</div>
            </div>
          </div>

          {r.type === 'ACCIDENT' && (
            <div className="card">
              <div className="card-title">{t('reportType.ACCIDENT')}</div>
              <Row
                label={t('accidentForm.accidentType')}
                value={
                  r.accidentType === 'OTHER' && r.otherAccidentType
                    ? r.otherAccidentType
                    : r.accidentType && t(`accidentType.${r.accidentType}`)
                }
              />
              <Row
                label={t('accidentForm.outcome')}
                value={
                  r.outcomeSeverity && t(`outcomeSeverity.${r.outcomeSeverity}`)
                }
              />
              <Row
                label={t('accidentForm.injuredName')}
                value={r.injuredName}
              />
              <Row
                label={t('accidentForm.injuredType')}
                value={r.injuredType && t(`personType.${r.injuredType}`)}
              />
              {r.bodyInjuries && r.bodyInjuries.length > 0 && (
                <>
                  <div className="card-title mt-16">
                    {t('accidentForm.bodyMapTitle')}
                  </div>
                  <table>
                    <thead>
                      <tr>
                        <th>{t('bodyPart.HEAD').slice(0, 0)}Bolge</th>
                        <th>{t('accidentForm.injuryType')}</th>
                        <th>{t('accidentForm.severity')}</th>
                        <th>{t('accidentForm.note')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {r.bodyInjuries.map((inj, i) => (
                        <tr key={i}>
                          <td>
                            {t(`bodyPart.${inj.bodyPart}`)}
                            {inj.side !== 'CENTER' &&
                              ` (${t(`bodySide.${inj.side}`)})`}{' '}
                            <span className="muted">
                              · {t(`bodyView.${inj.view}`)}
                            </span>
                          </td>
                          <td>{t(`injuryType.${inj.type}`)}</td>
                          <td>
                            <span className={`badge sev-${inj.severity}`}>
                              {t(`injurySeverity.${inj.severity}`)}
                            </span>
                          </td>
                          <td>{inj.note}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </>
              )}
            </div>
          )}

          {r.type === 'NEAR_MISS' && (
            <div className="card">
              <div className="card-title">{t('reportType.NEAR_MISS')}</div>
              <Row
                label={t('nearMissForm.category')}
                value={
                  r.nearMissCategory &&
                  t(`nearMissCategory.${r.nearMissCategory}`)
                }
              />
              <Row
                label={t('nearMissForm.hazard')}
                value={
                  r.hazardCategory === 'OTHER' && r.otherHazard
                    ? r.otherHazard
                    : r.hazardCategory && t(`hazardCategory.${r.hazardCategory}`)
                }
              />
              <Row
                label={t('nearMissForm.riskResult')}
                value={
                  r.riskLevel && (
                    <span className={`badge risk-${r.riskLevel}`}>
                      {r.riskScore} — {t(`riskLevel.${r.riskLevel}`)}
                    </span>
                  )
                }
              />
              <Row label={t('nearMissForm.rootCause')} value={r.rootCause} />
              <Row
                label={t('nearMissForm.immediateAction')}
                value={r.immediateAction}
              />
            </div>
          )}

          {/* Fotograflar */}
          {r.attachments && r.attachments.length > 0 && (
            <div className="card">
              <div className="card-title">📷 {t('reports.attachments')}</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
                {r.attachments.map((url) =>
                  isVideoUrl(url) ? (
                    <video
                      key={url}
                      src={url}
                      controls
                      style={{
                        width: 260,
                        maxHeight: 200,
                        borderRadius: 8,
                        border: '1px solid var(--border)',
                        background: '#000',
                      }}
                    />
                  ) : (
                    <a key={url} href={url} target="_blank" rel="noreferrer">
                      <img
                        src={url}
                        alt=""
                        style={{
                          width: 140,
                          height: 110,
                          objectFit: 'cover',
                          borderRadius: 8,
                          border: '1px solid var(--border)',
                        }}
                      />
                    </a>
                  ),
                )}
              </div>
            </div>
          )}

          {/* Duzeltici faaliyetler */}
          <div className="card">
            <div className="card-title">
              {t('permission.ACTION_MANAGE')} ({r.correctiveActions?.length || 0})
            </div>
            {r.correctiveActions && r.correctiveActions.length > 0 ? (
              <table>
                <tbody>
                  {r.correctiveActions.map((a) => (
                    <tr key={a.id}>
                      <td>{a.description}</td>
                      <td>
                        {a.assignedTo
                          ? `${a.assignedTo.firstName} ${a.assignedTo.lastName}`
                          : '—'}
                      </td>
                      <td>
                        {a.dueDate
                          ? new Date(a.dueDate).toLocaleDateString()
                          : '—'}
                      </td>
                      <td>
                        {canAction ? (
                          <select
                            value={a.status}
                            onChange={(e) =>
                              updateActionStatus(a.id, e.target.value)
                            }
                          >
                            {['OPEN', 'IN_PROGRESS', 'COMPLETED', 'VERIFIED'].map(
                              (s) => (
                                <option key={s} value={s}>
                                  {t(`actionStatus.${s}`)}
                                </option>
                              ),
                            )}
                          </select>
                        ) : (
                          <span className="badge">
                            {t(`actionStatus.${a.status}`)}
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="muted">{t('common.noData')}</div>
            )}

            {canAction && (
              <div className="mt-16" style={{ background: '#f8fafc', padding: 12, borderRadius: 8 }}>
                <div className="field">
                  <input
                    placeholder={t('permission.ACTION_MANAGE')}
                    value={actionDesc}
                    onChange={(e) => setActionDesc(e.target.value)}
                  />
                </div>
                <div className="row">
                  <div className="field">
                    <select
                      value={actionAssignee}
                      onChange={(e) => setActionAssignee(e.target.value)}
                    >
                      <option value="">{t('reports.assignedTo')}</option>
                      {users?.map((u) => (
                        <option key={u.id} value={u.id}>
                          {u.firstName} {u.lastName}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="field">
                    <input
                      type="date"
                      value={actionDue}
                      onChange={(e) => setActionDue(e.target.value)}
                    />
                  </div>
                  <button
                    type="button"
                    className="btn"
                    onClick={addAction}
                    style={{ alignSelf: 'flex-start' }}
                  >
                    +
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Yan panel - is akisi */}
        {(canManage || canAssign) && (
          <div style={{ flex: 1, minWidth: 260 }}>
            <div className="card">
              <div className="card-title">{t('common.actions')}</div>

              {canManage && (
                <div className="field">
                  <label>{t('reports.status')}</label>
                  <div className="flex gap-8">
                    <select
                      value={newStatus}
                      onChange={(e) => setNewStatus(e.target.value)}
                    >
                      <option value="">—</option>
                      {REPORT_STATUSES.map((s) => (
                        <option key={s} value={s}>
                          {t(`reportStatus.${s}`)}
                        </option>
                      ))}
                    </select>
                    <button className="btn btn-sm" onClick={changeStatus}>
                      {t('common.save')}
                    </button>
                  </div>
                </div>
              )}

              {canAssign && (
                <div className="field">
                  <label>{t('reports.assignedTo')}</label>
                  <div className="flex gap-8">
                    <select
                      value={assignee}
                      onChange={(e) => setAssignee(e.target.value)}
                    >
                      <option value="">—</option>
                      {users?.map((u) => (
                        <option key={u.id} value={u.id}>
                          {u.firstName} {u.lastName}
                        </option>
                      ))}
                    </select>
                    <button className="btn btn-sm" onClick={assign}>
                      {t('common.save')}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
