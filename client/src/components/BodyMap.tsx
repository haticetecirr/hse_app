import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { BodyInjury } from '../types';

interface Region {
  bodyPart: string;
  side: 'LEFT' | 'RIGHT' | 'CENTER';
  shape: 'circle' | 'ellipse' | 'rect';
  // circle: cx,cy,r  ellipse: cx,cy,rx,ry  rect: x,y,w,h(,rx)
  c: number[];
}

// Onden gorunum (kisi bize bakiyor: kisinin sagi = gorselin solu)
const FRONT: Region[] = [
  { bodyPart: 'HEAD', side: 'CENTER', shape: 'circle', c: [100, 30, 22] },
  { bodyPart: 'NECK', side: 'CENTER', shape: 'rect', c: [91, 50, 18, 12, 3] },
  { bodyPart: 'SHOULDER', side: 'RIGHT', shape: 'ellipse', c: [66, 74, 15, 11] },
  { bodyPart: 'SHOULDER', side: 'LEFT', shape: 'ellipse', c: [134, 74, 15, 11] },
  { bodyPart: 'CHEST', side: 'CENTER', shape: 'rect', c: [74, 66, 52, 46, 6] },
  { bodyPart: 'ABDOMEN', side: 'CENTER', shape: 'rect', c: [76, 112, 48, 44, 6] },
  { bodyPart: 'UPPER_ARM', side: 'RIGHT', shape: 'rect', c: [47, 80, 16, 44, 8] },
  { bodyPart: 'UPPER_ARM', side: 'LEFT', shape: 'rect', c: [137, 80, 16, 44, 8] },
  { bodyPart: 'ELBOW', side: 'RIGHT', shape: 'circle', c: [55, 128, 8] },
  { bodyPart: 'ELBOW', side: 'LEFT', shape: 'circle', c: [145, 128, 8] },
  { bodyPart: 'FOREARM', side: 'RIGHT', shape: 'rect', c: [46, 136, 15, 40, 7] },
  { bodyPart: 'FOREARM', side: 'LEFT', shape: 'rect', c: [139, 136, 15, 40, 7] },
  { bodyPart: 'HAND', side: 'RIGHT', shape: 'ellipse', c: [53, 184, 9, 12] },
  { bodyPart: 'HAND', side: 'LEFT', shape: 'ellipse', c: [147, 184, 9, 12] },
  { bodyPart: 'HIP', side: 'CENTER', shape: 'rect', c: [78, 156, 44, 26, 6] },
  { bodyPart: 'THIGH', side: 'RIGHT', shape: 'rect', c: [80, 182, 18, 56, 8] },
  { bodyPart: 'THIGH', side: 'LEFT', shape: 'rect', c: [102, 182, 18, 56, 8] },
  { bodyPart: 'KNEE', side: 'RIGHT', shape: 'circle', c: [89, 246, 10] },
  { bodyPart: 'KNEE', side: 'LEFT', shape: 'circle', c: [111, 246, 10] },
  { bodyPart: 'LOWER_LEG', side: 'RIGHT', shape: 'rect', c: [81, 256, 16, 56, 7] },
  { bodyPart: 'LOWER_LEG', side: 'LEFT', shape: 'rect', c: [103, 256, 16, 56, 7] },
  { bodyPart: 'ANKLE', side: 'RIGHT', shape: 'circle', c: [89, 318, 7] },
  { bodyPart: 'ANKLE', side: 'LEFT', shape: 'circle', c: [111, 318, 7] },
  { bodyPart: 'FOOT', side: 'RIGHT', shape: 'ellipse', c: [89, 330, 11, 8] },
  { bodyPart: 'FOOT', side: 'LEFT', shape: 'ellipse', c: [111, 330, 11, 8] },
];

// Arkadan gorunum (kisinin sagi = gorselin sagi)
const BACK: Region[] = [
  { bodyPart: 'HEAD', side: 'CENTER', shape: 'circle', c: [100, 30, 22] },
  { bodyPart: 'NECK', side: 'CENTER', shape: 'rect', c: [91, 50, 18, 12, 3] },
  { bodyPart: 'SHOULDER', side: 'LEFT', shape: 'ellipse', c: [66, 74, 15, 11] },
  { bodyPart: 'SHOULDER', side: 'RIGHT', shape: 'ellipse', c: [134, 74, 15, 11] },
  { bodyPart: 'BACK', side: 'CENTER', shape: 'rect', c: [74, 66, 52, 46, 6] },
  { bodyPart: 'LOWER_BACK', side: 'CENTER', shape: 'rect', c: [76, 112, 48, 44, 6] },
  { bodyPart: 'UPPER_ARM', side: 'LEFT', shape: 'rect', c: [47, 80, 16, 44, 8] },
  { bodyPart: 'UPPER_ARM', side: 'RIGHT', shape: 'rect', c: [137, 80, 16, 44, 8] },
  { bodyPart: 'ELBOW', side: 'LEFT', shape: 'circle', c: [55, 128, 8] },
  { bodyPart: 'ELBOW', side: 'RIGHT', shape: 'circle', c: [145, 128, 8] },
  { bodyPart: 'FOREARM', side: 'LEFT', shape: 'rect', c: [46, 136, 15, 40, 7] },
  { bodyPart: 'FOREARM', side: 'RIGHT', shape: 'rect', c: [139, 136, 15, 40, 7] },
  { bodyPart: 'HAND', side: 'LEFT', shape: 'ellipse', c: [53, 184, 9, 12] },
  { bodyPart: 'HAND', side: 'RIGHT', shape: 'ellipse', c: [147, 184, 9, 12] },
  { bodyPart: 'HIP', side: 'CENTER', shape: 'rect', c: [78, 156, 44, 26, 6] },
  { bodyPart: 'THIGH', side: 'LEFT', shape: 'rect', c: [80, 182, 18, 56, 8] },
  { bodyPart: 'THIGH', side: 'RIGHT', shape: 'rect', c: [102, 182, 18, 56, 8] },
  { bodyPart: 'KNEE', side: 'LEFT', shape: 'circle', c: [89, 246, 10] },
  { bodyPart: 'KNEE', side: 'RIGHT', shape: 'circle', c: [111, 246, 10] },
  { bodyPart: 'LOWER_LEG', side: 'LEFT', shape: 'rect', c: [81, 256, 16, 56, 7] },
  { bodyPart: 'LOWER_LEG', side: 'RIGHT', shape: 'rect', c: [103, 256, 16, 56, 7] },
  { bodyPart: 'ANKLE', side: 'LEFT', shape: 'circle', c: [89, 318, 7] },
  { bodyPart: 'ANKLE', side: 'RIGHT', shape: 'circle', c: [111, 318, 7] },
  { bodyPart: 'FOOT', side: 'LEFT', shape: 'ellipse', c: [89, 330, 11, 8] },
  { bodyPart: 'FOOT', side: 'RIGHT', shape: 'ellipse', c: [111, 330, 11, 8] },
];

interface Props {
  injuries: BodyInjury[];
  selected: { bodyPart: string; side: string; view: string } | null;
  onSelect: (r: { bodyPart: string; side: string; view: string }) => void;
}

export function BodyMap({ injuries, selected, onSelect }: Props) {
  const { t } = useTranslation();
  const [view, setView] = useState<'FRONT' | 'BACK'>('FRONT');
  const regions = view === 'FRONT' ? FRONT : BACK;

  const SEVERITY_ORDER = ['MINOR', 'MODERATE', 'SEVERE', 'CRITICAL'];

  // Bir bolgedeki en agir yaralanmanin ciddiyetini bulur
  function regionSeverity(r: Region): string | null {
    const here = injuries.filter(
      (i) => i.bodyPart === r.bodyPart && i.side === r.side && i.view === view,
    );
    if (here.length === 0) return null;
    return here.reduce((max, i) =>
      SEVERITY_ORDER.indexOf(i.severity) > SEVERITY_ORDER.indexOf(max.severity)
        ? i
        : max,
    ).severity;
  }

  function isSelected(r: Region) {
    return (
      selected?.bodyPart === r.bodyPart &&
      selected?.side === r.side &&
      selected?.view === view
    );
  }

  function className(r: Region) {
    if (isSelected(r)) return 'body-part selected';
    const sev = regionSeverity(r);
    if (sev) return `body-part sev-${sev}`;
    return 'body-part';
  }

  function renderShape(r: Region, idx: number) {
    const common = {
      className: className(r),
      onClick: () => onSelect({ bodyPart: r.bodyPart, side: r.side, view }),
      key: idx,
    };
    const title = `${t(`bodyPart.${r.bodyPart}`)}${
      r.side !== 'CENTER' ? ' (' + t(`bodySide.${r.side}`) + ')' : ''
    }`;
    if (r.shape === 'circle') {
      return (
        <circle {...common} cx={r.c[0]} cy={r.c[1]} r={r.c[2]}>
          <title>{title}</title>
        </circle>
      );
    }
    if (r.shape === 'ellipse') {
      return (
        <ellipse {...common} cx={r.c[0]} cy={r.c[1]} rx={r.c[2]} ry={r.c[3]}>
          <title>{title}</title>
        </ellipse>
      );
    }
    return (
      <rect
        {...common}
        x={r.c[0]}
        y={r.c[1]}
        width={r.c[2]}
        height={r.c[3]}
        rx={r.c[4] ?? 4}
      >
        <title>{title}</title>
      </rect>
    );
  }

  return (
    <div>
      <div className="view-toggle">
        <button
          type="button"
          className={`btn btn-sm ${view === 'FRONT' ? '' : 'btn-secondary'}`}
          onClick={() => setView('FRONT')}
        >
          {t('bodyView.FRONT')}
        </button>
        <button
          type="button"
          className={`btn btn-sm ${view === 'BACK' ? '' : 'btn-secondary'}`}
          onClick={() => setView('BACK')}
        >
          {t('bodyView.BACK')}
        </button>
      </div>
      <svg
        className="body-svg"
        viewBox="0 0 200 350"
        width="100%"
        style={{ maxWidth: 300, display: 'block', margin: '0 auto' }}
      >
        {regions.map(renderShape)}
      </svg>
      <div className="text-center muted" style={{ fontSize: 12 }}>
        {selected
          ? `${t(`bodyPart.${selected.bodyPart}`)}${
              selected.side !== 'CENTER'
                ? ' (' + t(`bodySide.${selected.side}`) + ')'
                : ''
            } — ${t(`bodyView.${selected.view}`)}`
          : t('accidentForm.selectPart')}
      </div>

      {/* Ciddiyet renk lejant */}
      <div className="severity-legend">
        {['MINOR', 'MODERATE', 'SEVERE', 'CRITICAL'].map((s) => (
          <span key={s} className="severity-legend-item">
            <span className={`severity-dot sev-fill-${s}`} />
            {t(`injurySeverity.${s}`)}
          </span>
        ))}
      </div>
    </div>
  );
}
