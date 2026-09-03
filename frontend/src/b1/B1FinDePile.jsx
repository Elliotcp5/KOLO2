// =============================================================
// KOLO — Écran de fin de pile
//
// Comportement (spec) :
// - Animation sablier (SVG animé)
// - Texte : "De nouvelles opportunités de mandat vous attendent dans"
// - Décompte HH:MM:SS jusqu'à la prochaine génération (03h00 Europe/Paris)
// - Si des cartes de veille sont disponibles ce jour, elles s'affichent
//   sous le décompte via <VeilleIntercalaire /> (chargé côté parent)
//
// Aucun cul-de-sac : l'utilisateur a toujours quelque chose à regarder.
// =============================================================
import React, { useEffect, useState } from 'react';

// ---------- Sablier SVG animé ----------
function Sablier({ size = 88 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 80 80" aria-hidden>
      <defs>
        <linearGradient id="sand-grad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#EC8690" />
          <stop offset="1" stopColor="#F4B0B7" />
        </linearGradient>
      </defs>
      <g stroke="#111827" strokeWidth="3" fill="none" strokeLinecap="round" strokeLinejoin="round">
        <path d="M18 8 L62 8" />
        <path d="M18 72 L62 72" />
        <path d="M22 8 Q22 30 40 40 Q58 30 58 8" />
        <path d="M22 72 Q22 50 40 40 Q58 50 58 72" />
      </g>
      {/* Sable qui tombe — animation CSS via style local */}
      <g fill="url(#sand-grad)">
        <path d="M25 11 Q40 22 55 11 L55 12 Q40 24 25 12 Z">
          <animate attributeName="opacity" values="1;1;0.4;1" dur="4s" repeatCount="indefinite" />
        </path>
        <rect x="39" y="41" width="2" height="0">
          <animate attributeName="height" values="0;28;28;0" dur="4s" repeatCount="indefinite" />
        </rect>
        <path d="M25 68 Q40 60 55 68 L55 69 Q40 62 25 69 Z">
          <animate attributeName="opacity" values="0.4;0.7;1;0.4" dur="4s" repeatCount="indefinite" />
        </path>
      </g>
    </svg>
  );
}

// ---------- Décompte 03h00 Europe/Paris ----------
// Utilise Intl.DateTimeFormat pour extraire l'heure Paris (DST-safe) puis
// calcule le nombre de secondes jusqu'à la prochaine occurrence de 03h00.
function secondsUntilNext03hParis() {
  const now = new Date();
  const fmt = new Intl.DateTimeFormat('fr-FR', {
    timeZone: 'Europe/Paris',
    hour: 'numeric', minute: 'numeric', second: 'numeric', hour12: false,
    year: 'numeric', month: 'numeric', day: 'numeric',
  });
  const parts = fmt.formatToParts(now).reduce((a, p) => (a[p.type] = p.value, a), {});
  const parisNow = new Date(Date.UTC(
    +parts.year, +parts.month - 1, +parts.day,
    +parts.hour, +parts.minute, +parts.second,
  ));
  // Cible = 03:00:00 du jour courant Paris
  let target = new Date(Date.UTC(+parts.year, +parts.month - 1, +parts.day, 3, 0, 0));
  if (parisNow >= target) {
    // Passé → cible demain
    target = new Date(target.getTime() + 24 * 3600 * 1000);
  }
  return Math.max(0, Math.floor((target - parisNow) / 1000));
}

function formatCountdown(totalSec) {
  const h = Math.floor(totalSec / 3600).toString().padStart(2, '0');
  const m = Math.floor((totalSec % 3600) / 60).toString().padStart(2, '0');
  const s = Math.floor(totalSec % 60).toString().padStart(2, '0');
  return { h, m, s };
}

// ---------- Composant final ----------
export function FinDePileScreen({ veilleSlot = null }) {
  const [remaining, setRemaining] = useState(() => secondsUntilNext03hParis());
  useEffect(() => {
    const t = setInterval(() => setRemaining((r) => (r > 0 ? r - 1 : secondsUntilNext03hParis())), 1000);
    return () => clearInterval(t);
  }, []);
  const { h, m, s } = formatCountdown(remaining);

  return (
    <div className="b1-fin-pile" data-testid="b1-fin-pile">
      <div className="b1-fin-pile-sablier">
        <Sablier />
      </div>
      <div className="b1-fin-pile-texte">
        De nouvelles opportunités de mandat vous attendent dans
      </div>
      <div className="b1-fin-pile-decompte" data-testid="b1-fin-pile-decompte">
        <span>{h}</span><em>:</em><span>{m}</span><em>:</em><span>{s}</span>
      </div>
      <div className="b1-fin-pile-decompte-label">heures — minutes — secondes</div>
      {veilleSlot && (
        <div className="b1-fin-pile-veille" data-testid="b1-fin-pile-veille">
          {veilleSlot}
        </div>
      )}
    </div>
  );
}
