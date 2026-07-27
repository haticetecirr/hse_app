import { forwardRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Report, isVideoUrl } from '../types';

// PDF cikti icin sade, A4 uyumlu duzen (html2pdf bu elemani yakalar).
export const PrintableReport = forwardRef<HTMLDivElement, { report: Report }>(
  ({ report: r }, ref) => {
    const { t } = useTranslation();

    const row = (label: string, value?: React.ReactNode) => {
      if (value === undefined || value === null || value === '') return null;
      return (
        <tr>
          <td
            style={{
              padding: '5px 8px',
              color: '#475569',
              fontSize: 12,
              width: 180,
              verticalAlign: 'top',
              borderBottom: '1px solid #eef2f7',
            }}
          >
            {label}
          </td>
          <td
            style={{
              padding: '5px 8px',
              fontSize: 12,
              fontWeight: 500,
              borderBottom: '1px solid #eef2f7',
            }}
          >
            {value}
          </td>
        </tr>
      );
    };

    const sectionTitle = (txt: string) => (
      <div
        style={{
          fontSize: 13,
          fontWeight: 700,
          color: '#0f172a',
          margin: '16px 0 6px',
          borderLeft: '3px solid #ea580c',
          paddingLeft: 8,
        }}
      >
        {txt}
      </div>
    );

    return (
      <div
        ref={ref}
        style={{
          width: 760,
          padding: 32,
          background: '#fff',
          color: '#0f172a',
          fontFamily: 'Segoe UI, system-ui, sans-serif',
        }}
      >
        {/* Baslik */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            borderBottom: '2px solid #0f172a',
            paddingBottom: 12,
          }}
        >
          <div>
            <div style={{ fontSize: 18, fontWeight: 700, color: '#ea580c' }}>
              {t('appName')}
            </div>
            <div style={{ fontSize: 12, color: '#64748b' }}>
              {t('appSubtitle')}
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 16, fontWeight: 700 }}>{r.referenceNo}</div>
            <div style={{ fontSize: 12, color: '#64748b' }}>
              {t(`reportType.${r.type}`)}
            </div>
          </div>
        </div>

        {sectionTitle(t('common.details'))}
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <tbody>
            {row(t('reports.status'), t(`reportStatus.${r.status}`))}
            {row(t('reports.location'), r.location)}
            {row(
              t('reports.occurredAt'),
              new Date(r.occurredAt).toLocaleString(),
            )}
            {row(
              t('reports.reporter'),
              `${r.reporter.firstName} ${r.reporter.lastName}`,
            )}
            {row(t('reports.department'), r.department?.name)}
            {row(t('reports.witnesses'), r.witnesses)}
            {row(t('reports.description'), r.description)}
          </tbody>
        </table>

        {r.type === 'ACCIDENT' && (
          <>
            {sectionTitle(t('reportType.ACCIDENT'))}
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <tbody>
                {row(
                  t('accidentForm.accidentType'),
                  r.accidentType === 'OTHER' && r.otherAccidentType
                    ? r.otherAccidentType
                    : r.accidentType && t(`accidentType.${r.accidentType}`),
                )}
                {row(
                  t('accidentForm.outcome'),
                  r.outcomeSeverity &&
                    t(`outcomeSeverity.${r.outcomeSeverity}`),
                )}
                {row(t('accidentForm.injuredName'), r.injuredName)}
                {row(
                  t('accidentForm.injuredType'),
                  r.injuredType === 'OTHER' && r.otherInjuredType
                    ? r.otherInjuredType
                    : r.injuredType && t(`personType.${r.injuredType}`),
                )}
              </tbody>
            </table>

            {r.bodyInjuries && r.bodyInjuries.length > 0 && (
              <>
                {sectionTitle(t('accidentForm.bodyMapTitle'))}
                <table
                  style={{
                    width: '100%',
                    borderCollapse: 'collapse',
                    fontSize: 12,
                  }}
                >
                  <thead>
                    <tr style={{ background: '#f1f5f9' }}>
                      <th style={thc}>{t('reports.location')}</th>
                      <th style={thc}>{t('accidentForm.injuryType')}</th>
                      <th style={thc}>{t('accidentForm.severity')}</th>
                      <th style={thc}>{t('accidentForm.note')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {r.bodyInjuries.map((inj, i) => (
                      <tr key={i}>
                        <td style={tdc}>
                          {t(`bodyPart.${inj.bodyPart}`)}
                          {inj.side !== 'CENTER' &&
                            ` (${t(`bodySide.${inj.side}`)})`}{' '}
                          · {t(`bodyView.${inj.view}`)}
                        </td>
                        <td style={tdc}>
                          {inj.type === 'OTHER' && inj.otherType
                            ? inj.otherType
                            : t(`injuryType.${inj.type}`)}
                        </td>
                        <td style={tdc}>
                          {t(`injurySeverity.${inj.severity}`)}
                        </td>
                        <td style={tdc}>{inj.note || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </>
            )}
          </>
        )}

        {r.type === 'NEAR_MISS' && (
          <>
            {sectionTitle(t('reportType.NEAR_MISS'))}
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <tbody>
                {row(
                  t('nearMissForm.category'),
                  r.nearMissCategory &&
                    t(`nearMissCategory.${r.nearMissCategory}`),
                )}
                {row(
                  t('nearMissForm.hazard'),
                  r.hazardCategory === 'OTHER' && r.otherHazard
                    ? r.otherHazard
                    : r.hazardCategory && t(`hazardCategory.${r.hazardCategory}`),
                )}
                {row(
                  t('nearMissForm.riskResult'),
                  r.riskLevel &&
                    `${r.riskScore} — ${t(`riskLevel.${r.riskLevel}`)}`,
                )}
                {row(t('nearMissForm.rootCause'), r.rootCause)}
                {row(t('nearMissForm.immediateAction'), r.immediateAction)}
              </tbody>
            </table>
          </>
        )}

        {/* Duzeltici faaliyetler */}
        {r.correctiveActions && r.correctiveActions.length > 0 && (
          <>
            {sectionTitle(t('permission.ACTION_MANAGE'))}
            <table
              style={{
                width: '100%',
                borderCollapse: 'collapse',
                fontSize: 12,
              }}
            >
              <tbody>
                {r.correctiveActions.map((a) => (
                  <tr key={a.id}>
                    <td style={tdc}>{a.description}</td>
                    <td style={tdc}>
                      {a.assignedTo
                        ? `${a.assignedTo.firstName} ${a.assignedTo.lastName}`
                        : '-'}
                    </td>
                    <td style={tdc}>{t(`actionStatus.${a.status}`)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}

        <div
          style={{
            marginTop: 24,
            paddingTop: 10,
            borderTop: '1px solid #e2e8f0',
            fontSize: 10,
            color: '#94a3b8',
            display: 'flex',
            justifyContent: 'space-between',
          }}
        >
          <span>{t('appName')}</span>
          <span>{new Date().toLocaleString()}</span>
        </div>

        {/* EK SAYFA: Fotograflar / Videolar (yeni sayfada, net) */}
        {r.attachments && r.attachments.length > 0 && (
          <div
            className="pdf-attachments-page"
            style={{
              breakBefore: 'page',
              pageBreakBefore: 'always',
              paddingTop: 8,
            }}
          >
            <div
              style={{
                fontSize: 15,
                fontWeight: 700,
                color: '#0f172a',
                margin: '4px 0 12px',
                borderBottom: '2px solid #0f172a',
                paddingBottom: 8,
              }}
            >
              EK — {t('reports.attachments')} ({r.referenceNo})
            </div>

            {r.attachments
              .filter((u) => !isVideoUrl(u))
              .map((url, i) => (
                <div
                  key={url}
                  className="pdf-photo"
                  style={{
                    marginBottom: 14,
                    textAlign: 'center',
                    breakInside: 'avoid',
                    pageBreakInside: 'avoid',
                  }}
                >
                  <img
                    src={url}
                    crossOrigin="anonymous"
                    style={{
                      maxWidth: '100%',
                      maxHeight: 420,
                      objectFit: 'contain',
                      border: '1px solid #e2e8f0',
                      borderRadius: 6,
                    }}
                  />
                  <div style={{ fontSize: 10, color: '#94a3b8', marginTop: 2 }}>
                    {t('reports.attachments')} #{i + 1}
                  </div>
                </div>
              ))}

            {/* Videolar PDF'e gomulemez -> not olarak listelenir */}
            {r.attachments.filter((u) => isVideoUrl(u)).length > 0 && (
              <div
                style={{
                  marginTop: 10,
                  padding: 12,
                  border: '1px dashed #cbd5e1',
                  borderRadius: 6,
                  fontSize: 12,
                  color: '#475569',
                }}
              >
                🎥{' '}
                {r.attachments.filter((u) => isVideoUrl(u)).length} video eki
                bu bildirime baglidir (uygulama uzerinden izlenebilir).
              </div>
            )}
          </div>
        )}
      </div>
    );
  },
);

const thc: React.CSSProperties = {
  padding: '5px 8px',
  textAlign: 'left',
  borderBottom: '1px solid #e2e8f0',
  fontSize: 11,
  color: '#475569',
};
const tdc: React.CSSProperties = {
  padding: '5px 8px',
  borderBottom: '1px solid #eef2f7',
};
