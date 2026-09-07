// KOLO — B1Screen : coquille de mise en page COMMUNE, utilisée par TOUS les
// écrans B1 sans exception. C'est le composant qui garantit que les zones
// sûres iOS (safe-area-inset) sont respectées partout de la même manière.
//
// 3 zones :
//   1. Header fixe (padding-top: env(safe-area-inset-top) + 16px) — ne défile pas
//   2. Contenu (seule zone qui défile) — padding-bottom: 80px + safe-area
//   3. Tab bar (fond blanc opaque, ombre haute, safe-area-bottom) — ne défile pas
//
// La bannière de debug rouge (marqueur fichier) reste, MAIS à l'intérieur
// de la zone sûre. Cachée en production via REACT_APP_SHOW_FILE_MARKER.
import React from 'react';

const SHOW_FILE_MARKER =
  (process.env.REACT_APP_SHOW_FILE_MARKER || '').toLowerCase() === '1'
  || (process.env.REACT_APP_SHOW_FILE_MARKER || '').toLowerCase() === 'true'
  || (typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('marker') === '1');

const STYLES = {
  root: {
    display: 'flex',
    flexDirection: 'column',
    height: '100dvh',
    width: '100%',
    maxWidth: 520,
    margin: '0 auto',
    background: '#F0EEF8',
    position: 'relative',
    overflow: 'hidden',
  },
  fileMarker: {
    background: '#FF0000',
    color: '#FFFFFF',
    height: 24,
    fontSize: 11,
    fontWeight: 700,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    fontFamily: 'ui-monospace, monospace',
  },
  header: {
    // Header fixe — safe-area-top + 16px. Ne défile jamais.
    paddingTop: 'calc(env(safe-area-inset-top) + 16px)',
    paddingLeft: 20,
    paddingRight: 20,
    paddingBottom: 12,
    flexShrink: 0,
    background: 'transparent',
    zIndex: 5,
  },
  content: {
    // Seule zone qui défile
    flex: 1,
    minHeight: 0,
    overflowY: 'auto',
    overflowX: 'hidden',
    paddingLeft: 20,
    paddingRight: 20,
    paddingBottom: 'calc(96px + env(safe-area-inset-bottom))',
    WebkitOverflowScrolling: 'touch',
  },
  contentNoScroll: {
    // Version sans scroll — Profil, Performances (doivent tenir sur 390×844)
    flex: 1,
    minHeight: 0,
    overflow: 'hidden',
    paddingLeft: 20,
    paddingRight: 20,
    paddingBottom: 'calc(96px + env(safe-area-inset-bottom))',
    display: 'flex',
    flexDirection: 'column',
  },
  tabBarSlot: {
    // Emplacement de la tab bar. Fond BLANC OPAQUE, aucune transparence,
    // ombre douce vers le HAUT.
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    background: '#FFFFFF',
    boxShadow: '0 -6px 24px rgba(17, 17, 17, 0.06)',
    paddingBottom: 'env(safe-area-inset-bottom)',
    zIndex: 40,
  },
};

/**
 * B1Screen — coquille standard.
 *
 * Props :
 *   • fileMarker (str) : chemin src/... affiché en bandeau rouge (dev)
 *   • header (node)    : zone header fixe, optionnelle
 *   • children (node)  : contenu (défile)
 *   • tabBar (node)    : tab bar (fixe en bas)
 *   • noScroll (bool)  : si true, le contenu ne défile pas (Profil, Perf)
 *   • contentStyle     : override styles zone contenu
 */
export default function B1Screen({
  fileMarker,
  header,
  children,
  tabBar,
  noScroll = false,
  contentStyle = {},
}) {
  return (
    <div style={STYLES.root} data-testid="b1-screen-root">
      {SHOW_FILE_MARKER && fileMarker && (
        <div style={STYLES.fileMarker} data-testid="b1-file-marker">
          {fileMarker}
        </div>
      )}
      {header && (
        <div style={STYLES.header} data-testid="b1-screen-header">
          {header}
        </div>
      )}
      <div
        style={{ ...(noScroll ? STYLES.contentNoScroll : STYLES.content), ...contentStyle }}
        data-testid="b1-screen-content"
      >
        {children}
      </div>
      {tabBar && (
        <div style={STYLES.tabBarSlot} data-testid="b1-screen-tabbar-slot">
          {tabBar}
        </div>
      )}
    </div>
  );
}
