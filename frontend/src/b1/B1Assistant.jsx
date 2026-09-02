// KOLO — Assistant KOLO (chat conversationnel Pro)
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bot, Send, Trash2, X, History, PenSquare } from 'lucide-react';
import b1t from './b1i18n';
import b1api from './b1api';

export function AssistantPage() {
  const navigate = useNavigate();
  const [status, setStatus] = useState(null);
  const [user, setUser] = useState({});
  const [messages, setMessages] = useState([]);
  const [conversationId, setConversationId] = useState(null);
  const [input, setInput] = useState('');
  const [streaming, setStreaming] = useState(false);
  const [context, setContext] = useState(null);
  const [ctxOpen, setCtxOpen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [pickerItems, setPickerItems] = useState({ estimations: [], dossiers: [] });
  const [convs, setConvs] = useState([]);
  const [error, setError] = useState('');
  const scrollRef = useRef(null);

  useEffect(() => { (async () => {
    try {
      const s = await b1api.getAssistantStatus();
      setStatus(s);
      const p = await b1api.getProfil?.().catch(() => null);
      if (p?.profil) setUser(p.profil);
      const l = await b1api.listConversations();
      setConvs(l.conversations || []);
    } catch (e) { setError(String(e.message || e)); }
  })(); }, []);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, streaming]);

  const openContext = async () => {
    if (!ctxOpen) {
      try {
        const [e, d] = await Promise.all([b1api.getEstimations(), b1api.getDossiers()]);
        setPickerItems({ estimations: e.estimations || [], dossiers: d.dossiers || [] });
      } catch {}
    }
    setCtxOpen(!ctxOpen);
  };

  const send = useCallback(async (text) => {
    const message = (text || input).trim();
    if (!message || streaming) return;
    setError('');
    setInput('');
    setMessages((m) => [...m, { role: 'user', content: message }, { role: 'assistant', content: '' }]);
    setStreaming(true);
    await b1api.streamChat({
      message, conversation_id: conversationId, context,
      onMeta: (m) => { if (m.conversation_id) setConversationId(m.conversation_id); },
      onDelta: (delta) => {
        setMessages((prev) => {
          const copy = [...prev];
          copy[copy.length - 1] = { role: 'assistant', content: (copy[copy.length - 1].content || '') + delta };
          return copy;
        });
      },
      onError: (e) => {
        if (e.code === 'plan_insuffisant') { navigate('/app-b1/profil'); return; }
        if (e.code === 'plafond_atteint') setError(b1t('as.plafond'));
        else setError(b1t('as.err.reseau'));
      },
      onDone: () => setStreaming(false),
    });
    setStreaming(false);
    // refresh conv list + status (quota utilisé)
    b1api.listConversations().then((l) => setConvs(l.conversations || [])).catch(() => {});
    b1api.getAssistantStatus().then(setStatus).catch(() => {});
  }, [input, streaming, conversationId, context, navigate]);

  const deleteConv = async (cid) => {
    if (!window.confirm(b1t('as.hist.confirm'))) return;
    try { await b1api.deleteConversation(cid); } catch {}
    setConvs((l) => l.filter((c) => c.conversation_id !== cid));
    if (conversationId === cid) { setConversationId(null); setMessages([]); }
  };
  const openConv = async (cid) => {
    try {
      const r = await b1api.getConversation(cid);
      setConversationId(cid);
      setMessages(r.conversation.messages || []);
      setContext(r.conversation.context || null);
    } catch {}
  };

  if (status && !status.access) {
    return (
      <div className="b1-root b1-page" style={{ padding: 24 }} data-testid="as-wall">
        <div style={{ textAlign: 'center', maxWidth: 480, margin: '48px auto' }}>
          <Bot size={56} color="var(--b1-accent)" style={{ marginBottom: 16 }} />
          <h1 className="b1-h1" style={{ fontSize: 22, marginBottom: 8 }}>{b1t('as.wall.titre')}</h1>
          <p style={{ color: 'var(--b1-text-secondary)', marginBottom: 24 }}>{b1t('as.wall.sous')}</p>
          <button type="button" className="b1-pill b1-pill--primary" onClick={() => navigate('/app-b1/profil')} data-testid="as-upgrade">{b1t('as.wall.cta')}</button>
        </div>
      </div>
    );
  }

  const prenom = user?.prenom || user?.name || '';
  const showSuggestions = messages.length === 0;

  return (
    <div className="b1-root b1-page" style={{ display: 'flex', flexDirection: 'column', height: '100dvh', padding: 0 }} data-testid="as-page">
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', borderBottom: '1px solid var(--b1-border)' }}>
        <Bot size={20} color="var(--b1-accent)" />
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 600 }}>{b1t('as.header.titre')}</div>
          <div style={{ fontSize: 12, color: 'var(--b1-text-muted)' }}>{b1t('as.header.sous')}</div>
        </div>
        <button
          type="button"
          onClick={() => setDrawerOpen(true)}
          aria-label={b1t('as.hist.titre')}
          data-testid="as-open-history"
          style={{ border: 0, background: 'transparent', padding: 6, cursor: 'pointer' }}
        >
          <History size={20} color="var(--b1-text-secondary)" />
        </button>
      </div>

      <div style={{ padding: '6px 16px', borderBottom: '1px solid var(--b1-border)' }}>
        <button type="button" className="b1-pill b1-pill--ghost" onClick={openContext} data-testid="as-ctx-btn" style={{ fontSize: 12 }}>
          {context ? b1t('as.ctx.label', { label: context.label || context.id }) : b1t('as.ctx.aucun')}
          {context && <X size={12} style={{ marginLeft: 6 }} onClick={(e) => { e.stopPropagation(); setContext(null); }} />}
        </button>
        {ctxOpen && (
          <div className="b1-card" style={{ padding: 12, marginTop: 8 }}>
            <div style={{ fontSize: 11, color: 'var(--b1-text-muted)', margin: '0 0 6px' }}>{b1t('as.ctx.estimation')}</div>
            {pickerItems.estimations.slice(0, 5).map((e) => (
              <div key={e.estimation_id} style={{ padding: 6, cursor: 'pointer', fontSize: 13 }}
                   onClick={() => { setContext({ type: 'estimation', id: e.estimation_id, label: e.adresse }); setCtxOpen(false); }}
                   data-testid={`as-ctx-est-${e.estimation_id}`}>
                {e.adresse}
              </div>
            ))}
            <div style={{ fontSize: 11, color: 'var(--b1-text-muted)', margin: '10px 0 6px' }}>{b1t('as.ctx.dossier')}</div>
            {pickerItems.dossiers.slice(0, 5).map((d) => (
              <div key={d.dossier_id} style={{ padding: 6, cursor: 'pointer', fontSize: 13 }}
                   onClick={() => { setContext({ type: 'dossier', id: d.dossier_id, label: d?.sections?.identification?.adresse || d?.sections?.dossier?.ref }); setCtxOpen(false); }}
                   data-testid={`as-ctx-dos-${d.dossier_id}`}>
                {d?.sections?.identification?.adresse || d?.sections?.dossier?.ref}
              </div>
            ))}
          </div>
        )}
      </div>

      <div ref={scrollRef} style={{ flex: 1, overflowY: 'auto', padding: '16px' }}>
        {messages.length === 0 && (
          <div style={{ padding: 16, background: 'var(--b1-accent-light)', borderRadius: 14, marginBottom: 12 }} data-testid="as-welcome">
            {b1t('as.accueil', { prenom })}
          </div>
        )}
        {showSuggestions && (
          <div style={{ display: 'grid', gap: 8, marginBottom: 12 }}>
            {['as.sug.1','as.sug.2','as.sug.3'].map((k, i) => (
              <button key={k} type="button" className="b1-pill b1-pill--ghost" onClick={() => send(b1t(k))} data-testid={`as-sug-${i+1}`} style={{ textAlign: 'left', whiteSpace: 'normal', lineHeight: 1.35 }}>
                {b1t(k)}
              </button>
            ))}
          </div>
        )}
        {messages.map((m, idx) => (
          <div key={idx} style={{ display: 'flex', justifyContent: m.role === 'user' ? 'flex-end' : 'flex-start', marginBottom: 8 }} data-testid={`as-msg-${m.role}`}>
            <div style={{
              maxWidth: '82%', padding: '10px 14px', borderRadius: 14,
              background: m.role === 'user' ? '#DDEBFF' : 'var(--b1-accent-light)',
              color: m.role === 'user' ? '#0F2C55' : 'var(--b1-text-primary)',
              whiteSpace: 'pre-wrap', fontSize: 14,
            }}>{m.content || (streaming && idx === messages.length - 1 ? '…' : '')}</div>
          </div>
        ))}
        {error && <div style={{ color: 'var(--b1-danger)', fontSize: 13, padding: 8 }} data-testid="as-error">{error}</div>}
      </div>

      <div style={{ display: 'flex', gap: 8, padding: '10px 16px', borderTop: '1px solid var(--b1-border)' }}>
        <input
          className="b1-input"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), send())}
          placeholder={b1t('as.saisir')}
          data-testid="as-input"
          style={{ flex: 1, margin: 0 }}
          disabled={streaming}
        />
        <button type="button" className="b1-pill b1-pill--primary" onClick={() => send()} disabled={!input.trim() || streaming} data-testid="as-send" aria-label={b1t('as.envoyer')} style={{ padding: '10px 14px' }}>
          <Send size={16} />
        </button>
      </div>

      {status?.quota?.used >= 80 && (
        <div
          style={{ fontSize: 11, textAlign: 'right', padding: '0 16px 8px', color: status.quota.used >= 100 ? 'var(--b1-danger)' : 'var(--b1-text-muted)' }}
          data-testid="as-quota-count"
        >
          {b1t('as.quota.count', { n: status.quota.used })}
        </div>
      )}

      {drawerOpen && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)', zIndex: 90 }}
          onClick={() => setDrawerOpen(false)}
          data-testid="as-drawer-backdrop"
        >
          <div
            style={{ position: 'absolute', top: 0, right: 0, bottom: 0, width: '82%', maxWidth: 360, background: 'var(--b1-card)', padding: 20, overflowY: 'auto', boxShadow: '-8px 0 24px rgba(0,0,0,0.15)' }}
            onClick={(e) => e.stopPropagation()}
            data-testid="as-drawer"
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
              <div style={{ flex: 1, fontWeight: 600 }}>{b1t('as.hist.titre')}</div>
              <button type="button" onClick={() => setDrawerOpen(false)} aria-label={b1t('sys.retour') || 'Close'} style={{ border: 0, background: 'transparent', padding: 4, cursor: 'pointer' }} data-testid="as-drawer-close">
                <X size={18} />
              </button>
            </div>
            <button
              type="button"
              className="b1-pill b1-pill--primary"
              style={{ width: '100%', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 16 }}
              onClick={() => {
                setConversationId(null);
                setMessages([]);
                setContext(null);
                setInput('');
                setError('');
                setDrawerOpen(false);
              }}
              data-testid="as-new-conversation"
            >
              <PenSquare size={16} /> {b1t('as.hist.nouvelle')}
            </button>
            {convs.length === 0 ? (
              <div style={{ color: 'var(--b1-text-muted)', fontSize: 13 }} data-testid="as-hist-empty">{b1t('as.hist.vide')}</div>
            ) : convs.map((c) => (
              <div key={c.conversation_id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 0', borderBottom: '1px solid var(--b1-border)' }}>
                <button
                  type="button"
                  onClick={() => { openConv(c.conversation_id); setDrawerOpen(false); }}
                  data-testid={`as-hist-${c.conversation_id}`}
                  style={{ flex: 1, textAlign: 'left', background: 'transparent', border: 0, cursor: 'pointer', fontSize: 13, padding: 0 }}
                >
                  {c.title || '—'}
                </button>
                <button
                  type="button"
                  onClick={() => deleteConv(c.conversation_id)}
                  data-testid={`as-del-${c.conversation_id}`}
                  style={{ background: 'transparent', border: 0, cursor: 'pointer' }}
                >
                  <Trash2 size={14} color="var(--b1-text-muted)" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default AssistantPage;
