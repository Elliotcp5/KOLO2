// KOLO — Vignette de tête de carte d'opportunité (build 2.24 refonte)
// -----------------------------------------------------------------------------
// Point d'entrée : <OppVignette opp={cur} height={160} />
//
// Comportement par défaut (KOLO_MAP_PROVIDER non défini côté backend) :
//   Aplat de couleur généré déterministiquement à partir du nom de rue.
//   Icône de type de bien (Home / Building2) au centre en grand.
//   Adresse en bas à gauche sur dégradé sombre pour rester lisible.
//   Pastille DPE en haut à droite.
//
// Comportement carto (provider Google/Mapbox/OSM activé côté backend) :
//   Le composant tente `GET /api/opportunites/{opp_id}/vignette`.
//   Si 200 → affiche l'image (cachée par opp_id côté serveur, une seule
//   requête externe par opp à vie).
//   Si 404 ou toute erreur → fallback aplat + icône (jamais d'écran cassé).
//
// Le user a exigé qu'on lui confirme fournisseur et coût AVANT activation.
// L'endpoint côté backend refuse tant que `KOLO_MAP_PROVIDER` n'est pas défini.
// -----------------------------------------------------------------------------
import React, { useEffect, useState } from 'react';
import { Home, Building2 } from 'lucide-react';

// Palette d'aplats — dérivés du rose de marque et teintes complémentaires
// discrètes. Chaque couleur est mate et fonctionne avec du blanc dessus.
const PALETTE = [
  '#EC8690', // rose de marque
  '#F5A6AE', // rose clair
  '#B69AC1', // mauve doux
  '#8C9EBE', // bleu-gris
  '#A8B99D', // vert-sauge
  '#CDA37F', // terre
  '#D68C82', // corail
  '#6E7BA0', // bleu ardoise
];

function _hash(s) {
  // FNV-1a rapide déterministe — évite les collisions banales sur "Rue de la…"
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) >>> 0;
  }
  return h;
}

function pickColor(seed) {
  const h = _hash(String(seed || 'kolo'));
  return PALETTE[h % PALETTE.length];
}

function pickTypeIcon(type_bien) {
  const t = String(type_bien || '').toLowerCase();
  if (t.includes('maison')) return Home;
  return Building2;
}

/**
 * @param {object} props
 * @param {object} props.opp — { id, adresse, type_bien, dpe }
 * @param {number} [props.height=160]
 */
export function OppVignette({ opp, height = 160 }) {
  const [imgOk, setImgOk] = useState(false);

  // On tente directement un <img src=...>. Si 404 (token absent, opp sans
  // coords, erreur Mapbox) → onError bascule sur le fallback aplat. 1 seule
  // requête GET, pas de probe HEAD préalable.
  const base = process.env.REACT_APP_BACKEND_URL || '';
  const imgUrl = opp?.id ? `${base}/api/opportunites/${opp.id}/vignette` : null;

  useEffect(() => {
    // reset quand l'opp change (nouveau swipe)
    setImgOk(false);
  }, [opp?.id]);

  const bg = pickColor(opp?.adresse);
  const TypeIcon = pickTypeIcon(opp?.type_bien);

  return (
    <div
      className="b1-opp-vignette"
      data-testid="b1-opp-vignette"
      style={{
        position: 'relative',
        width: '100%',
        height,
        borderTopLeftRadius: 'inherit',
        borderTopRightRadius: 'inherit',
        overflow: 'hidden',
        background: bg,
      }}
    >
      {imgUrl && (
        <img
          src={imgUrl}
          alt=""
          loading="lazy"
          onLoad={() => setImgOk(true)}
          onError={() => { setImgOk(false); }}
          style={{
            position: 'absolute', inset: 0,
            width: '100%', height: '100%',
            objectFit: 'cover',
            opacity: imgOk ? 1 : 0,
            transition: 'opacity 240ms ease-out',
          }}
          data-testid="b1-opp-vignette-img"
        />
      )}

      {/* Fallback : icône bien au centre en grand */}
      {!imgOk && (
        <div style={{
          position: 'absolute', inset: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <TypeIcon size={72} color="rgba(255,255,255,0.72)" strokeWidth={1.4} />
        </div>
      )}

      {/* Pastille DPE en haut à droite */}
      {opp?.dpe && (
        <span
          data-testid="b1-opp-vignette-dpe"
          style={{
            position: 'absolute', top: 12, right: 12,
            width: 30, height: 30,
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            borderRadius: 8,
            background: dpeBg(opp.dpe),
            color: '#fff',
            fontWeight: 800, fontSize: 14,
            boxShadow: '0 2px 6px rgba(0,0,0,0.18)',
            fontFamily: 'system-ui,-apple-system,sans-serif',
          }}
        >
          {String(opp.dpe).toUpperCase()}
        </span>
      )}

      {/* Adresse en bas à gauche + dégradé sombre pour la lisibilité.
          Spec Bloc 7 : rue SEULE (sans CP ni ville), 13 px, blanc 90 %,
          une seule ligne avec ellipsis plutôt que wrap. */}
      <div style={{
        position: 'absolute', left: 0, right: 0, bottom: 0,
        padding: '28px 16px 12px',
        background: 'linear-gradient(to top, rgba(0,0,0,0.55) 0%, rgba(0,0,0,0.15) 60%, rgba(0,0,0,0) 100%)',
        color: 'rgba(255,255,255,0.90)',
        fontSize: 13, fontWeight: 700, letterSpacing: 0.2,
        textShadow: '0 1px 2px rgba(0,0,0,0.35)',
        pointerEvents: 'none',
        whiteSpace: 'nowrap',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
      }}>
        {streetOnly(opp?.adresse)}
      </div>
    </div>
  );
}

// Couleurs DPE officielles (A vert foncé → G rouge foncé)
function dpeBg(dpe) {
  const c = String(dpe || '').toUpperCase();
  const map = {
    A: '#00A651', B: '#4CB847', C: '#B7D332',
    D: '#F7B32B', E: '#F58220', F: '#E8493B', G: '#C1272D',
  };
  return map[c] || '#8C9EBE';
}

/**
 * Extrait la rue seule depuis une adresse complète.
 * « 20 Avenue elsa triolet 13008 Marseille »  →  « 20 Avenue elsa triolet »
 * On supprime tout bloc contenant un code postal (5 chiffres FR) et ce qui suit.
 * Si aucun CP détecté, on renvoie la chaîne entière.
 */
function streetOnly(adresse) {
  const s = String(adresse || '').trim();
  if (!s) return '';
  // regex : coupe au premier code postal 5 chiffres (avec espace avant)
  const m = s.match(/^(.*?)[,\s]+\d{5}\b.*$/);
  return m ? m[1].trim() : s;
}

export default OppVignette;
