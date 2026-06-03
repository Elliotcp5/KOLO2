import React, { useEffect, useRef, useState } from 'react';
import { Mic, MicOff } from 'lucide-react';
import { toast } from 'sonner';

/**
 * VoiceDictateButton — browser-native speech-to-text.
 * Uses Web Speech API (Chrome / Safari iOS 14.5+). No backend cost, no Whisper.
 *
 * Props:
 *   value: current text value (string)
 *   onChange: (newText) => void — receives full text (existing + transcript appended)
 *   locale: 'fr' | 'en' | 'de' | 'it' — defaults to 'fr'
 *   size: number (px) — defaults to 28
 *   testId: data-testid string
 *   className: extra css class
 *
 * Usage:
 *   <VoiceDictateButton value={notes} onChange={setNotes} locale="fr" />
 */
const LOCALE_MAP = {
  fr: 'fr-FR',
  en: 'en-US',
  de: 'de-DE',
  it: 'it-IT',
};

const HINTS = {
  fr: { listening: 'J\'écoute…', start: 'Dicter', notSupported: 'La dictée vocale n\'est pas supportée sur ce navigateur (essayez Chrome ou Safari)' },
  en: { listening: 'Listening…', start: 'Dictate', notSupported: 'Voice dictation not supported on this browser (try Chrome or Safari)' },
  de: { listening: 'Höre zu…', start: 'Diktieren', notSupported: 'Spracherkennung wird in diesem Browser nicht unterstützt' },
  it: { listening: 'In ascolto…', start: 'Detta', notSupported: 'Dettatura vocale non supportata su questo browser' },
};

export const VoiceDictateButton = ({
  value = '',
  onChange,
  locale = 'fr',
  size = 36,
  testId = 'voice-dictate-btn',
  className = '',
  inline = false,
}) => {
  const [listening, setListening] = useState(false);
  const [supported, setSupported] = useState(true);
  const recognitionRef = useRef(null);
  const baseRef = useRef('');
  const hints = HINTS[locale] || HINTS.fr;

  useEffect(() => {
    const SR = typeof window !== 'undefined' && (window.SpeechRecognition || window.webkitSpeechRecognition);
    if (!SR) { setSupported(false); return; }
    const rec = new SR();
    rec.continuous = true;
    rec.interimResults = true;
    rec.lang = LOCALE_MAP[locale] || 'fr-FR';
    rec.onresult = (event) => {
      let interim = '';
      let finalText = '';
      for (let i = event.resultIndex; i < event.results.length; ++i) {
        const r = event.results[i];
        if (r.isFinal) finalText += r[0].transcript;
        else interim += r[0].transcript;
      }
      const next = (baseRef.current + (baseRef.current && !baseRef.current.endsWith(' ') ? ' ' : '') + finalText + interim).trimStart();
      onChange && onChange(next);
      if (finalText) {
        baseRef.current = (baseRef.current + (baseRef.current && !baseRef.current.endsWith(' ') ? ' ' : '') + finalText).trim();
      }
    };
    rec.onend = () => setListening(false);
    rec.onerror = (e) => {
      setListening(false);
      if (e.error && e.error !== 'aborted' && e.error !== 'no-speech') {
        toast.error(`Dictée : ${e.error}`);
      }
    };
    recognitionRef.current = rec;
    return () => { try { rec.abort(); } catch (_) {} };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locale]);

  const toggle = (e) => {
    e?.preventDefault?.();
    e?.stopPropagation?.();
    const rec = recognitionRef.current;
    if (!rec) { toast.error(hints.notSupported); return; }
    if (listening) {
      try { rec.stop(); } catch (_) {}
      setListening(false);
      return;
    }
    baseRef.current = value || '';
    try {
      rec.start();
      setListening(true);
    } catch (err) {
      // start() throws if already started — restart cleanly
      try { rec.abort(); rec.start(); setListening(true); } catch (_) {}
    }
  };

  if (!supported) return null;

  const baseStyle = inline ? {
    width: size, height: size, minWidth: size,
    borderRadius: 10,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    border: 'none',
    cursor: 'pointer',
    background: listening
      ? 'linear-gradient(135deg, #EF4444, #DC2626)'
      : 'linear-gradient(135deg, #8B5CF6, #6D28D9)',
    color: 'white',
    boxShadow: listening
      ? '0 0 0 4px rgba(239, 68, 68, 0.18), 0 6px 14px -4px rgba(239, 68, 68, 0.45)'
      : '0 4px 10px -2px rgba(139, 92, 246, 0.35)',
    transition: 'transform 160ms cubic-bezier(0.22, 1, 0.36, 1), box-shadow 220ms ease',
  } : {};

  return (
    <button
      type="button"
      onClick={toggle}
      data-testid={testId}
      aria-label={listening ? hints.listening : hints.start}
      title={listening ? hints.listening : hints.start}
      className={`kolo-dictate-btn ${listening ? 'is-listening' : ''} ${className}`}
      style={baseStyle}
    >
      {listening ? <MicOff size={Math.round(size * 0.5)} strokeWidth={2.2} /> : <Mic size={Math.round(size * 0.5)} strokeWidth={2.2} />}
      {listening && <span className="kolo-dictate-pulse" aria-hidden="true" />}
    </button>
  );
};

export default VoiceDictateButton;
