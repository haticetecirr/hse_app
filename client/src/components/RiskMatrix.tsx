import { useTranslation } from 'react-i18next';

// 5x5 risk matrisi -> seviye/renk (backend ile ayni mantik)
export function riskLevel(score: number): 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' {
  if (score <= 4) return 'LOW';
  if (score <= 9) return 'MEDIUM';
  if (score <= 15) return 'HIGH';
  return 'CRITICAL';
}

interface Props {
  severity: number; // satir
  likelihood: number; // sutun
  onChange: (severity: number, likelihood: number) => void;
}

export function RiskMatrix({ severity, likelihood, onChange }: Props) {
  const { t } = useTranslation();
  const rows = [5, 4, 3, 2, 1]; // ciddiyet (ust=5)
  const cols = [1, 2, 3, 4, 5]; // olasilik

  return (
    <table className="matrix">
      <thead>
        <tr>
          <th></th>
          <th colSpan={5} style={{ fontSize: 11 }}>
            {t('nearMissForm.likelihood')} →
          </th>
        </tr>
        <tr>
          <th style={{ fontSize: 10 }}>{t('nearMissForm.severity')} ↓</th>
          {cols.map((c) => (
            <th key={c}>{c}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((s) => (
          <tr key={s}>
            <th>{s}</th>
            {cols.map((l) => {
              const score = s * l;
              const level = riskLevel(score);
              const active = severity === s && likelihood === l;
              return (
                <td
                  key={l}
                  className={`cell risk-${level} ${active ? 'active' : ''}`}
                  onClick={() => onChange(s, l)}
                  title={`${score} - ${t(`riskLevel.${level}`)}`}
                >
                  {score}
                </td>
              );
            })}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
