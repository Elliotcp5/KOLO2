// KOLO — Modale de dictée vocale (sections composition/technique/environnement/swot)
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Mic, X } from 'lucide-react';
import b1t from './b1i18n';
import b1api from './b1api';

export const DICTABLE = ['composition','technique','environnement','swot'];

const CLIENT_KEY = () => `dic_${Date.now()}_${Math.random().toString(36).slice(2,10)}`;

export function DictationButton({ dossierId, sectionId, onApplyValues }) {
  const [open, setOpen] = useState(false);
  if (!DICTABLE.includes(sectionId)) return null;
  return (
    <>
      <button
        type="button"
        className="b1-pill b1-pill--ghost"
        onClick={() => setOpen(true)}
        data-testid="dic-open"
        style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
      >
        <Mic size={16} /> {b1t('dic.bouton')}
      </button>
      <div style={{ fontSize: 12, color: 'var(--b1-text-muted)', marginTop: 4 }}>{b1t('dic.sous')}</div>
      {open && (
        <DictationModal
          dossierId={dossierId}
          sectionId={sectionId}
          onClose={() => setOpen(false)}
          onApply={(vals) => { onApplyValues(vals); setOpen(false); }}
        />
      )}
    </>
  );
}

function DictationModal({ dossierId, sectionId, onClose, onApply }) {
  const [phase, setPhase] = useState('idle'); // idle | recording | processing | review | error
  const [elapsed, setElapsed] = useState(0);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [accepted, setAccepted] = useState({}); // {field_id: value edited}
  const mediaRef = useRef(null);
  const chunksRef = useRef([]);
  const timerRef = useRef(null);
  const clientKeyRef = useRef(CLIENT_KEY());

  const start = useCallback(async () => {
    setError(''); setResult(null); setAccepted({}); setElapsed(0);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const rec = new MediaRecorder(stream);
      chunksRef.current = [];
      rec.ondataavailable = (e) => e.data.size && chunksRef.current.push(e.data);
      rec.onstop = () => stream.getTracks().forEach((t) => t.stop());
      rec.start();
      mediaRef.current = rec;
      setPhase('recording');
      const started = Date.now();
      timerRef.current = setInterval(() => {
        const s = Math.floor((Date.now() - started) / 1000);
        setElapsed(s);
        if (s >= 180) stopRecordingAndSend();
      }, 250);
    } catch (e) {
      setError(String(e.message || e)); setPhase('error');
    }
  }, []);

  const stopRecordingAndSend = useCallback(async () => {
    const rec = mediaRef.current;
    if (!rec) return;
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    await new Promise((resolve) => { rec.onstop = () => resolve(); rec.stop(); });
    const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
    if (blob.size > 10 * 1024 * 1024) {
      setError(b1t('dic.err.trop_lourd')); setPhase('error'); return;
    }
    setPhase('processing');
    try {
      const j = await b1api.postDictee(dossierId, sectionId, blob, clientKeyRef.current);
      setResult(j);
      const acc = {};
      (j.proposals || []).forEach((p) => { acc[p.field_id] = p.value_proposed; });
      setAccepted(acc);
      setPhase('review');
    } catch (e) {
      const msg = String(e.message || '');
      if (msg.includes('audio_trop_long')) setError(b1t('dic.err.trop_long'));
      else if (msg.includes('audio_trop_lourd')) setError(b1t('dic.err.trop_lourd'));
      else if (msg.includes('transcription_vide')) setError(b1t('dic.err.transcript'));
      else setError(b1t('dic.err.transcript'));
      setPhase('error');
    }
  }, [dossierId, sectionId]);

  const cancel = () => {
    if (mediaRef.current && mediaRef.current.state === 'recording') mediaRef.current.stop();
    if (timerRef.current) clearInterval(timerRef.current);
    onClose();
  };

  useEffect(() => start(), [start]);

  const [rejected, setRejected] = useState({});
  const applySelected = () => {
    const applied = {};
    (result?.proposals || []).forEach((p) => {
      if (!rejected[p.field_id] && accepted[p.field_id] != null && accepted[p.field_id] !== '') {
        applied[p.field_id] = accepted[p.field_id];
      }
    });
    onApply(applied);
  };
  const mm = String(Math.floor(elapsed / 60)).padStart(2, '0');
  const ss = String(elapsed % 60).padStart(2, '0');

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 100, display: 'flex', alignItems: 'flex-end' }} data-testid="dic-modal">
      <div style={{ background: 'var(--b1-card)', width: '100%', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 24, maxHeight: '90vh', overflowY: 'auto' }}>
        {phase === 'recording' && (
          <>
            <h3 style={{ margin: '0 0 12px' }}>{b1t('dic.rec.titre')}</h3>
            <div style={{ fontSize: 32, fontFamily: 'DM Mono, monospace', textAlign: 'center', margin: '20px 0' }} data-testid="dic-timer">{mm}:{ss} / 3:00</div>
            {elapsed >= 150 && <div style={{ fontSize: 13, color: 'var(--b1-accent)', textAlign: 'center', marginBottom: 12 }}>{b1t('dic.rec.limite')}</div>}
            <button type="button" className="b1-pill b1-pill--primary" style={{ width: '100%', marginBottom: 8 }} onClick={stopRecordingAndSend} data-testid="dic-stop">{b1t('dic.rec.arreter')}</button>
            <button type="button" className="b1-pill b1-pill--ghost" style={{ width: '100%' }} onClick={cancel} data-testid="dic-cancel">{b1t('dic.rec.annuler')}</button>
            <div style={{ fontSize: 11, color: 'var(--b1-text-muted)', textAlign: 'center', marginTop: 12 }}>{b1t('dic.rec.tag')}</div>
          </>
        )}
        {phase === 'processing' && (
          <>
            <h3>{b1t('dic.rec.titre')}</h3>
            <div style={{ padding: '24px 0', color: 'var(--b1-text-secondary)' }} data-testid="dic-processing">
              {elapsed < 3 ? b1t('dic.wait.l1') : elapsed < 7 ? b1t('dic.wait.l2') : b1t('dic.wait.l3')}
            </div>
          </>
        )}
        {phase === 'error' && (
          <>
            <h3>{b1t('dic.err.transcript')}</h3>
            <p style={{ color: 'var(--b1-text-secondary)' }} data-testid="dic-error">{error}</p>
            <button type="button" className="b1-pill b1-pill--primary" onClick={start} data-testid="dic-retry">{b1t('dic.err.reessayer')}</button>
            <button type="button" className="b1-pill b1-pill--ghost" style={{ marginLeft: 8 }} onClick={cancel}>{b1t('dic.rec.annuler')}</button>
          </>
        )}
        {phase === 'review' && result && (
          <>
            <h3 style={{ margin: '0 0 4px' }} data-testid="dic-review-title">
              {b1t('dic.val.titre', { n: result.proposals.length, s: result.proposals.length > 1 ? 's' : '' })}
            </h3>
            <p style={{ color: 'var(--b1-text-secondary)', fontSize: 13, margin: '0 0 16px' }}>{b1t('dic.val.sous')}</p>
            {result.proposals.length === 0 && (
              <p style={{ color: 'var(--b1-text-muted)' }}>{b1t('dic.err.extract')}</p>
            )}
            {result.proposals.map((p) => (
              <div key={p.field_id} style={{ padding: '10px 0', borderBottom: '1px solid var(--b1-border)', opacity: rejected[p.field_id] ? 0.4 : 1 }} data-testid={`dic-prop-${p.field_id}`}>
                <div style={{ fontSize: 12, color: 'var(--b1-text-muted)', marginBottom: 4 }}>{p.label}</div>
                {p.type === 'list' ? (
                  <textarea
                    className="b1-input" rows={3}
                    value={Array.isArray(accepted[p.field_id]) ? accepted[p.field_id].join('\n') : ''}
                    onChange={(e) => setAccepted((s) => ({ ...s, [p.field_id]: e.target.value.split('\n').filter(Boolean) }))}
                  />
                ) : (
                  <input
                    className="b1-input"
                    value={accepted[p.field_id] ?? ''}
                    onChange={(e) => setAccepted((s) => ({ ...s, [p.field_id]: p.type === 'int' ? (e.target.value === '' ? '' : Number(e.target.value)) : e.target.value }))}
                    data-testid={`dic-input-${p.field_id}`}
                  />
                )}
                <div style={{ marginTop: 6 }}>
                  <button type="button" className="b1-pill b1-pill--ghost" onClick={() => setRejected((s) => ({ ...s, [p.field_id]: !s[p.field_id] }))} data-testid={`dic-reject-${p.field_id}`}>
                    {rejected[p.field_id] ? b1t('dic.val.valider') : b1t('dic.val.rejeter')}
                  </button>
                </div>
              </div>
            ))}
            <details style={{ marginTop: 12 }}>
              <summary style={{ cursor: 'pointer', fontSize: 12, color: 'var(--b1-text-muted)' }}>{b1t('dic.val.brute')}</summary>
              <div style={{ fontSize: 13, marginTop: 8, color: 'var(--b1-text-secondary)', fontStyle: 'italic' }} data-testid="dic-transcript">« {result.transcription} »</div>
            </details>
            <button type="button" className="b1-pill b1-pill--primary" style={{ width: '100%', marginTop: 16 }} onClick={applySelected} data-testid="dic-apply">{b1t('dic.val.enregistrer')}</button>
            <button type="button" className="b1-pill b1-pill--ghost" style={{ width: '100%', marginTop: 8 }} onClick={cancel}>{b1t('dic.val.tout_rejeter')}</button>
          </>
        )}
      </div>
    </div>
  );
}

export default DictationButton;
