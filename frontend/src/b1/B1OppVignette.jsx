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
  const [imgUrl, setImgUrl] = useState(null);

  useEffect(() => {
    // Tente l'image carto ; en cas d'échec (provider off, 404, réseau)
    // reste sur le fallback. Aucune requête inutile après un premier échec
    // — on n'active la carto que si `KOLO_MAP_PROVIDER` est mis côté serveur.
    let cancelled = false;
    (async () => {
      try {
        const base = process.env.REACT_APP_BACKEND_URL || '';
        const url = `${base}/api/opportunites/${opp.id}/vignette`;
        const r = await fetch(url, { method: 'HEAD' });
        if (cancelled) return;
        if (r.ok) {
          setImgUrl(url);
          setImgOk(true);
        }
      } catch (_e) { /* fallback silencieux */ }
    })();
    return () => { cancelled = true; };
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
      {imgOk && imgUrl && (
        <img
          src={imgUrl}
          alt=""
          loading="lazy"
          onError={() => { setImgOk(false); }}
          style={{
            position: 'absolute', inset: 0,
            width: '100%', height: '100%',
            objectFit: 'cover',
          }}
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

      {/* Adresse en bas à gauche + dégradé sombre pour la lisibilité */}
      <div style={{
        position: 'absolute', left: 0, right: 0, bottom: 0,
        padding: '28px 16px 12px',
        background: 'linear-gradient(to top, rgba(0,0,0,0.55) 0%, rgba(0,0,0,0.15) 60%, rgba(0,0,0,0) 100%)',
        color: '#fff',
        fontSize: 13, fontWeight: 700, letterSpacing: 0.2,
        textShadow: '0 1px 2px rgba(0,0,0,0.35)',
        pointerEvents: 'none',
      }}>
        {opp?.adresse || ''}
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

export default OppVignette;
