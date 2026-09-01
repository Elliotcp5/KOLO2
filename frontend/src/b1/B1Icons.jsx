// KOLO B1 — 4 icônes SVG custom pour la bottom nav (swipe, calc, doc, robot).
import React from 'react';

export const IconSwipe = ({ size = 22, ...p }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" {...p}>
    <path d="M10 16V7a2 2 0 0 1 4 0v6" />
    <path d="M14 11a2 2 0 0 1 4 0v5" />
    <path d="M6 14a2 2 0 0 1 4 0v3" />
    <path d="M18 17a4 4 0 0 1-4 4h-3a5 5 0 0 1-5-5v-3" />
    <path d="M4 8l2-2 2 2" />
    <path d="M6 6v6" />
  </svg>
);

export const IconCalc = ({ size = 22, ...p }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" {...p}>
    <rect x="4" y="3" width="16" height="18" rx="2.5" />
    <line x1="8" y1="7" x2="16" y2="7" />
    <circle cx="9" cy="12" r="0.6" fill="currentColor" />
    <circle cx="12" cy="12" r="0.6" fill="currentColor" />
    <circle cx="15" cy="12" r="0.6" fill="currentColor" />
    <path d="M9 16.5h2.5M14 16.5v0M14 15.5v2" />
    <path d="M15.4 17.3l1.1-1.1M15.4 16.2l1.1 1.1" />
  </svg>
);

export const IconReport = ({ size = 22, ...p }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" {...p}>
    <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
    <polyline points="14 3 14 8 19 8" />
    <line x1="12" y1="12" x2="12" y2="18" />
    <polyline points="9 15 12 18 15 15" />
  </svg>
);

export const IconRobot = ({ size = 22, ...p }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" {...p}>
    <rect x="4" y="8" width="16" height="12" rx="4" />
    <path d="M12 8V4" />
    <circle cx="12" cy="4" r="1" fill="currentColor" />
    <circle cx="9" cy="14" r="1" fill="currentColor" />
    <circle cx="15" cy="14" r="1" fill="currentColor" />
    <path d="M9 17.5c1 .8 4 .8 6 0" />
  </svg>
);

export const IconStats = ({ size = 20, ...p }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" {...p}>
    <rect x="4" y="12" width="4" height="8" rx="1.5" />
    <rect x="10" y="7" width="4" height="13" rx="1.5" />
    <rect x="16" y="3" width="4" height="17" rx="1.5" />
  </svg>
);

export const IconUser = ({ size = 22, ...p }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" {...p}>
    <circle cx="12" cy="12" r="9" />
    <circle cx="12" cy="10" r="3.2" />
    <path d="M6.5 19.2C7.8 17 9.7 15.7 12 15.7s4.2 1.3 5.5 3.5" />
  </svg>
);
