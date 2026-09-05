// =============================================================
// KOLO — Fixes marker (ancré sous B1BuildStamp)
//
// Objectif : SANS AMBIGUÏTÉ, savoir en 1 coup d'œil sur l'écran de
// connexion quels correctifs sont VRAIMENT embarqués dans le bundle
// courant. Chaque marqueur est une chaîne littérale — si elle apparaît
// à l'écran, elle est dans le bundle. Sinon, le fix n'est pas embarqué.
//
// Convention : on inline les chaînes brutes qui NE peuvent PAS être
// tree-shakées ni condensées (les backticks empêchent la mort par
// dead-code elimination).
// =============================================================
import React from 'react';

// Signatures littérales — chaque const référence une chaîne UNIQUE issue
// de son correctif ; si elle est absente du bundle, le code du correctif
// est absent avec elle. On les LIT toutes pour forcer leur survie.
const S_COMPOSER = `composer:76+safe`;      // fix 1 — as-composer margin-bottom
const S_ESTIMER = `estimer:mm-btn`;         // fix 2 — b1-mm-estimer button
const S_STATUTS = `statuts:pastilles-couleur`; // fix 3 — b1-mm-toggle-btn data-key
const S_LAZY = `lazy:12-routes`;            // fix 4 — Suspense + React.lazy
const S_SAFEAREA = `marges:safe-area-top`;  // fix 5 — .b1-screen safe-area-inset-top
const S_CHAT = `chat:EC8690-3B82F6`;        // fix 7 — bulles rose franc + typing
const S_FINPILE = `finpile:recap-mandats`;  // fix 8 — récap Vous avez traité + bouton
const S_LOGO = `logo:league-spartan-900`;   // fix 10 — logotype texte KOLO

const FIXES = [
  S_COMPOSER, S_ESTIMER, S_STATUTS, S_LAZY,
  S_SAFEAREA, S_CHAT, S_FINPILE, S_LOGO,
];

// Compact list — codes courts pour l'utilisateur : composer,estimer,statuts,lazy,marges,chat,finpile,logo
export const KOLO_FIXES_CODES = FIXES.map((s) => s.split(':')[0]).join(',');

export default function B1FixesMarker({ style = {} }) {
  return (
    <div
      data-testid="kolo-fixes-marker"
      title={FIXES.join(' · ')}
      style={{
        marginTop: 2,
        marginBottom: 12,
        textAlign: 'center',
        fontSize: 10,
        color: 'rgba(0,0,0,0.28)',
        letterSpacing: '0.15px',
        fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
        ...style,
      }}
    >
      fixes: {KOLO_FIXES_CODES}
    </div>
  );
}
