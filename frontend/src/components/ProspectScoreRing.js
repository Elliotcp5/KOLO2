import React from 'react';
import { Flame, Thermometer, Snowflake, MinusCircle } from 'lucide-react';

/**
 * Premium animated SVG score ring for prospect "chaud / tiède / froid"
 * - Animated arc with halo
 * - Icon at center
 * - Score label badge can be rendered separately via <ScoreLabel />
 *
 * Props:
 *   score: 'chaud' | 'tiede' | 'froid' | null
 *   size: number (px) — default 68
 *   showHalo: boolean — default true
 *   onClick: optional click handler
 */
export const ProspectScoreRing = ({ score, size = 68, showHalo = true, onClick }) => {
  const normalized = score === 'chaud' || score === 'tiede' || score === 'froid' ? score : 'none';
  const stroke = Math.round(size * 0.075);
  const radius = (size - stroke) / 2;
  const circ = 2 * Math.PI * radius;

  const Icon = normalized === 'chaud' ? Flame
    : normalized === 'tiede' ? Thermometer
    : normalized === 'froid' ? Snowflake
    : MinusCircle;
  const iconSize = Math.round(size * 0.32);

  return (
    <button
      type="button"
      className="kolo-score-ring"
      data-score={normalized}
      data-testid={`prospect-score-ring-${normalized}`}
      onClick={onClick}
      aria-label={`Score: ${normalized}`}
      style={{
        '--size': `${size}px`,
        '--stroke': `${stroke}px`,
        '--circ': circ,
        background: 'transparent',
        border: 'none',
        padding: 0,
        cursor: onClick ? 'pointer' : 'default',
      }}
    >
      {showHalo && normalized !== 'none' && <span className="halo" aria-hidden="true" />}
      <svg viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
        <circle className="track" cx={size / 2} cy={size / 2} r={radius} />
        <circle className="progress" cx={size / 2} cy={size / 2} r={radius} />
      </svg>
      <span className="center">
        <span className="center-icon">
          <Icon size={iconSize} strokeWidth={2.2} />
        </span>
      </span>
    </button>
  );
};

/**
 * Small label pill next to a score ring (or used alone)
 * Locale-aware via prop
 */
export const ScoreLabel = ({ score, locale = 'fr' }) => {
  const normalized = score === 'chaud' || score === 'tiede' || score === 'froid' ? score : null;
  if (!normalized) return null;

  const labels = {
    fr: { chaud: 'Chaud', tiede: 'Tiède', froid: 'Froid' },
    en: { chaud: 'Hot', tiede: 'Warm', froid: 'Cold' },
    de: { chaud: 'Heiß', tiede: 'Warm', froid: 'Kalt' },
    it: { chaud: 'Caldo', tiede: 'Tiepido', froid: 'Freddo' },
  };
  const colors = { chaud: '#EF4444', tiede: '#F59E0B', froid: '#3B82F6' };
  const label = (labels[locale] || labels.en)[normalized];

  return (
    <span
      className="kolo-score-label"
      style={{ '--score-color': colors[normalized] }}
      data-testid={`prospect-score-label-${normalized}`}
    >
      {label}
    </span>
  );
};

export default ProspectScoreRing;
