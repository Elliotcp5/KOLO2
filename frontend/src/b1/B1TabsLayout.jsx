// KOLO — Bloc 6 : coquille persistante des onglets B1
// -----------------------------------------------------------------------------
// Monte UNE SEULE FOIS la barre d'onglets (<BottomTabPill>). Seul le contenu
// change via <Outlet>. Supprime le re-mount complet de la tab bar à chaque
// changement d'onglet, qui causait un flash blanc depuis le build 78.
//
// Les onglets qui bénéficient de ce layout sont :
//   /app-b1                             → Opportunités
//   /app-b1/estimation                  → Estimation (home)
//   /app-b1/rapport                     → Dossier (liste)
//   /app-b1/assistant                   → Assistant
//   /app-b1/profil                      → Profil (home)
//   /app-b1/directeur/equipe-b224       → Mon équipe (directeur)
//   /app-b1/directeur/perf-agence       → Perf agence (directeur)
//
// Les sous-pages (/app-b1/profil/perso, /app-b1/estimation/flow, etc.) sortent
// de ce layout : elles sont des écrans détaillés qui ne doivent pas afficher la
// tab bar et où la navigation n'est pas horizontale.
// -----------------------------------------------------------------------------
import React, { useMemo } from 'react';
import { Outlet, useLocation, matchPath } from 'react-router-dom';
import { BottomTabPill } from './B1Shell';

const TAB_MATCHERS = [
  { id: 'opportunites', path: '/app-b1' },
  { id: 'estimation',   path: '/app-b1/estimation' },
  { id: 'rapport',      path: '/app-b1/rapport' },
  { id: 'assistant',    path: '/app-b1/assistant' },
  { id: 'profil',       path: '/app-b1/profil' },
  { id: 'mon_equipe',   path: '/app-b1/directeur/equipe-b224' },
  { id: 'perf_agence',  path: '/app-b1/directeur/perf-agence' },
];

function pickActive(pathname) {
  for (const t of TAB_MATCHERS) {
    if (matchPath({ path: t.path, end: true }, pathname)) return t.id;
  }
  return null;
}

export default function B1TabsLayout() {
  const location = useLocation();
  const active = useMemo(() => pickActive(location.pathname), [location.pathname]);
  return (
    <>
      {/* La key fait rejouer l'animation fade-in uniquement sur le contenu,
          jamais sur la tab bar — l'utilisateur voit un fondu propre. */}
      <div className="b1-tab-content" data-testid="b1-tab-content" key={location.pathname}>
        <Outlet />
      </div>
      <BottomTabPill active={active} />
    </>
  );
}
