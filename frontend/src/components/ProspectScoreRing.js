import React from 'react';
import { Flame, Thermometer, Snowflake, MinusCircle } from 'lucide-react';

/**
 * Premium animated SVG score ring for prospect heat.
 *
 * Modes:
 *  - Quantitative (heat_score 0-100, PRO+ feature) → real gauge proportional to score
 *  - Qualitative (score = 'chaud'/'tiede'/'froid') → fixed thresholds (92/58/24)
 *
 * Props:
 *   heatScore: number 0-100 (priority over `score` if provided)
 *   score: 'chaud' | 'tiede' | 'froid' | null (qualitative fallback)
 *   size: number (px) — default 68
 *   showHalo: boolean — default true
 *   showValue: boolean — render the numeric value below the icon (only in quantitative mode)
 *   onClick: optional click handler
 */
const heatToBand = (n) => {
  if (n == null) return null;
  if (n <= 33) return 'froid';
  if (n <= 66) return 'tiede';
  return 'chaud';
};

const BAND_COLOR = { chaud: '#EF4444', tiede: '#F59E0B', froid: '#3B82F6' };

export const ProspectScoreRing = ({
  heatScore = null,
  score = null,
  size = 68,
  showHalo = true,
  showValue = false,
  onClick,
}) => {
  const hasNumeric = typeof heatScore === 'number' && !isNaN(heatScore);
  const numeric = hasNumeric ? Math.max(0, Math.min(100, Math.round(heatScore))) : null;
  const band = hasNumeric ? heatToBand(numeric) : (score === 'chaud' || score === 'tiede' || score === 'froid' ? score : null);
  const dataAttr = band || 'none';

  const stroke = Math.round(size * 0.075);
  const radius = (size - stroke) / 2;
  const circ = 2 * Math.PI * radius;

  const Icon = band === 'chaud' ? Flame
    : band === 'tiede' ? Thermometer
    : band === 'froid' ? Snowflake
    : MinusCircle;
  const iconSize = Math.round(size * (showValue && hasNumeric ? 0.25 : 0.32));

  const color = band ? BAND_COLOR[band] : '#9CA3AF';
  const pct = hasNumeric ? numeric : (band === 'chaud' ? 92 : band === 'tiede' ? 58 : band === 'froid' ? 24 : 0);

  return (
    <button
      type="button"
      className="kolo-score-ring"
      data-score={dataAttr}
      data-testid={`prospect-score-ring-${dataAttr}`}
      onClick={onClick}
      aria-label={hasNumeric ? `Score : ${numeric}/100` : `Score: ${dataAttr}`}
      style={{
        '--size': `${size}px`,
        '--stroke': `${stroke}px`,
        '--circ': circ,
        '--color': color,
        '--pct': pct,
        background: 'transparent',
        border: 'none',
        padding: 0,
        cursor: onClick ? 'pointer' : 'default',
      }}
    >
      {showHalo && band && <span className="halo" aria-hidden="true" />}
      <svg viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
        <circle className="track" cx={size / 2} cy={size / 2} r={radius} />
        <circle className="progress" cx={size / 2} cy={size / 2} r={radius} />
      </svg>
      <span className="center">
        <span className="center-icon" style={{ display: 'grid', placeItems: 'center', textAlign: 'center', lineHeight: 1 }}>
          <Icon size={iconSize} strokeWidth={2.2} />
          {showValue && hasNumeric && (
            <span style={{
              fontSize: Math.round(size * 0.18),
              fontWeight: 800,
              color,
              letterSpacing: '-0.02em',
              marginTop: 1,
              fontVariantNumeric: 'tabular-nums',
            }}>{numeric}</span>
          )}
        </span>
      </span>
    </button>
  );
};

/**
 * Score label pill — renders qualitative or "XX/100" depending on mode
 */
export const ScoreLabel = ({ heatScore = null, score = null, locale = 'fr' }) => {
  const hasNumeric = typeof heatScore === 'number' && !isNaN(heatScore);
  const band = hasNumeric ? heatToBand(heatScore) : (score === 'chaud' || score === 'tiede' || score === 'froid' ? score : null);
  if (!band) return null;

  const labels = {
    fr: { chaud: 'Chaud', tiede: 'Tiède', froid: 'Froid' },
    en: { chaud: 'Hot', tiede: 'Warm', froid: 'Cold' },
    de: { chaud: 'Heiß', tiede: 'Warm', froid: 'Kalt' },
    it: { chaud: 'Caldo', tiede: 'Tiepido', froid: 'Freddo' },
  };
  const text = hasNumeric ? `${Math.round(heatScore)}/100` : (labels[locale] || labels.en)[band];

  return (
    <span
      className="kolo-score-label"
      style={{ '--score-color': BAND_COLOR[band] }}
      data-testid={`prospect-score-label-${band}`}
    >
      {text}
    </span>
  );
};

export default ProspectScoreRing;
