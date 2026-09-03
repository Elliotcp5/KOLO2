// =============================================================
// KOLO — Estampille de build (bas login + profil)
//
// Objectif : lire depuis TestFlight EXACTEMENT quel bundle est ouvert.
// Le pipeline Codemagic injecte `REACT_APP_BUILD_ID` avant `yarn build`
// (format : "<build>-<sha7>-<UTC>"), CRA l'inline dans le bundle JS.
//
// Fallback local dev : "dev-<timestamp>".
//
// Utilisation :
//   <B1BuildStamp />         → petit texte gris centré
//   <B1BuildStamp inline />  → sans style de bloc (pour footer inline)
// =============================================================
import React from 'react';

const RAW = (typeof process !== 'undefined' && process.env && process.env.REACT_APP_BUILD_ID)
  || 'dev-' + (typeof window !== 'undefined' ? String(Date.now()).slice(-8) : 'ssr');

export const KOLO_BUILD_ID = RAW;

export default function B1BuildStamp({ inline = false, style = {} }) {
  const s = inline
    ? { fontSize: 11, color: 'rgba(0,0,0,0.35)', letterSpacing: '0.2px', ...style }
    : {
        marginTop: 24,
        marginBottom: 12,
        textAlign: 'center',
        fontSize: 11,
        color: 'rgba(0,0,0,0.35)',
        letterSpacing: '0.2px',
        fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
        ...style,
      };
  return (
    <div style={s} data-testid="kolo-build-stamp" title={KOLO_BUILD_ID}>
      build {KOLO_BUILD_ID}
    </div>
  );
}
