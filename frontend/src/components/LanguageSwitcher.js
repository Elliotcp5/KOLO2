import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Check } from 'lucide-react';
import { useLocale } from '../context/LocaleContext';

/**
 * Compact language switcher with country flags.
 * Detects locale via the existing IP-based auto-detection in LocaleContext.
 * Clicking a language persists the choice (kolo_locale_manual=true).
 */
const LANGS = [
  { code: 'fr', flag: '🇫🇷', label: 'Français' },
  { code: 'en', flag: '🇬🇧', label: 'English' },
  { code: 'it', flag: '🇮🇹', label: 'Italiano' },
  { code: 'de', flag: '🇩🇪', label: 'Deutsch' },
];

const LanguageSwitcher = ({ variant = 'light', testid = 'lang-switcher' }) => {
  const { locale, changeLanguage } = useLocale();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const onClick = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const current = LANGS.find((l) => l.code === locale) || LANGS[1];
  const isDark = variant === 'dark';

  return (
    <div ref={ref} style={{ position: 'relative', display: 'inline-block' }} data-testid={testid}>
      <button
        onClick={() => setOpen((v) => !v)}
        data-testid={`${testid}-trigger`}
        aria-label="Change language"
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 6,
          padding: '7px 11px', borderRadius: 999,
          background: isDark ? 'rgba(255,255,255,0.08)' : 'transparent',
          border: `1px solid ${isDark ? 'rgba(255,255,255,0.18)' : 'rgba(0,0,0,0.1)'}`,
          color: isDark ? '#fff' : '#0B0B0F',
          fontSize: 13, fontWeight: 600, cursor: 'pointer',
          transition: 'all 160ms ease',
          fontFamily: 'inherit',
        }}
      >
        <span style={{ fontSize: 16, lineHeight: 1 }} aria-hidden="true">{current.flag}</span>
        <span style={{ fontSize: 12.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{current.code}</span>
        <ChevronDown size={13} strokeWidth={2.2} style={{ transition: 'transform 0.2s ease', transform: open ? 'rotate(180deg)' : 'none' }} />
      </button>

      {open && (
        <div
          data-testid={`${testid}-menu`}
          style={{
            position: 'absolute', top: 'calc(100% + 8px)', right: 0,
            background: '#fff', borderRadius: 12,
            boxShadow: '0 16px 40px -12px rgba(0,0,0,0.18), 0 0 0 1px rgba(0,0,0,0.06)',
            overflow: 'hidden', minWidth: 170, zIndex: 60,
          }}
        >
          {LANGS.map((l) => (
            <button
              key={l.code}
              onClick={() => { changeLanguage(l.code); setOpen(false); }}
              data-testid={`${testid}-option-${l.code}`}
              style={{
                display: 'flex', alignItems: 'center', gap: 10,
                width: '100%', padding: '11px 14px',
                background: l.code === locale ? 'rgba(139,92,246,0.08)' : 'transparent',
                border: 'none', cursor: 'pointer', textAlign: 'left',
                fontSize: 13.5, color: '#0B0B0F', fontWeight: 500,
                transition: 'background 120ms ease',
                fontFamily: 'inherit',
              }}
              onMouseEnter={(e) => { if (l.code !== locale) e.currentTarget.style.background = 'rgba(0,0,0,0.04)'; }}
              onMouseLeave={(e) => { if (l.code !== locale) e.currentTarget.style.background = 'transparent'; }}
            >
              <span style={{ fontSize: 18 }} aria-hidden="true">{l.flag}</span>
              <span style={{ flex: 1 }}>{l.label}</span>
              {l.code === locale && <Check size={14} color="#7C3AED" strokeWidth={2.5} />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default LanguageSwitcher;
