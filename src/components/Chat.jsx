import { useCallback, useEffect, useRef, useState } from 'react';
import { LuSend, LuCheck, LuCheckCheck, LuRotateCw, LuClock, LuCircleAlert } from 'react-icons/lu';
import { supabase } from '../lib/supabase';
import * as api from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { useData } from '../context/DataContext';

function Status({ m }) {
  if (m.local === 'sending') return <span className="inline-flex items-center gap-1"><LuClock size={11} /> Sending</span>;
  if (m.local === 'failed') return <span className="inline-flex items-center gap-1 text-red"><LuCircleAlert size={11} /> Not sent</span>;
  if (m.read_at) return <span className="inline-flex items-center gap-1 text-teal"><LuCheckCheck size={12} /> Read</span>;
  if (m.delivered_at) return <span className="inline-flex items-center gap-1"><LuCheckCheck size={12} /> Delivered</span>;
  return <span className="inline-flex items-center gap-1"><LuCheck size={12} /> Sent</span>;
}

const fmt = (iso) => new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
const mergeById = (list, row) => (list.some((m) => m.id === row.id)
  ? list.map((m) => (m.id === row.id ? { ...m, ...row } : m))
  : [...list, row]);

export default function Chat({ contact }) {
  const { user } = useAuth();
  const { refreshUnread } = useData();
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [text, setText] = useState('');
  const bottom = useRef(null);
  const me = user.id;

  const load = useCallback(async () => {
    try {
      setMessages(await api.fetchConversation(me, contact.id));
      setError('');
      await api.markConversationRead(contact.id);
      refreshUnread();
    } catch (e) { setError(e.message); } finally { setLoading(false); }
  }, [me, contact.id, refreshUnread]);

  useEffect(() => {
    setLoading(true); setMessages([]);
    load();
    const onRow = (row) => {
      const inThread = (row.sender_id === me && row.recipient_id === contact.id)
        || (row.sender_id === contact.id && row.recipient_id === me);
      if (!inThread) return;
      setMessages((l) => {
        // Replace the optimistic copy (same client_id) with the stored row.
        const withoutLocal = l.filter((m) => !(m.local && m.client_id === row.client_id));
        return mergeById(withoutLocal, row);
      });
      if (row.recipient_id === me) api.markConversationRead(contact.id).then(refreshUnread).catch(() => {});
    };
    const ch = supabase.channel(`chat:${me}:${contact.id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `recipient_id=eq.${me}` }, (p) => onRow(p.new))
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'messages', filter: `sender_id=eq.${me}` }, (p) => onRow(p.new))
      .subscribe((s) => { if (s === 'SUBSCRIBED') load(); });
    return () => { supabase.removeChannel(ch); };
  }, [me, contact.id, load, refreshUnread]);

  useEffect(() => { bottom.current?.scrollIntoView({ block: 'end' }); }, [messages.length]);

  const deliver = useCallback(async (m) => {
    setMessages((l) => l.map((x) => (x.client_id === m.client_id ? { ...x, local: 'sending' } : x)));
    try {
      const row = await api.sendMessage(contact.id, m.body, m.client_id);
      setMessages((l) => mergeById(l.filter((x) => !(x.local && x.client_id === m.client_id)), row));
    } catch (e) {
      setMessages((l) => l.map((x) => (x.client_id === m.client_id ? { ...x, local: 'failed', err: e.message } : x)));
    }
  }, [contact.id]);

  const submit = (e) => {
    e.preventDefault();
    const body = text.trim();
    if (!body) return;
    setText('');
    const m = {
      id: `local-${crypto.randomUUID()}`, client_id: crypto.randomUUID(), sender_id: me,
      recipient_id: contact.id, body, created_at: new Date().toISOString(), local: 'sending',
    };
    setMessages((l) => [...l, m]);
    deliver(m);
  };

  return (
    <div className="flex flex-col h-[420px]">
      <div className="flex-1 overflow-y-auto space-y-2 p-3 bg-[#f4f8f7] rounded-xl border border-line" aria-live="polite">
        {loading && <p className="text-mut text-sm text-center">Loading conversation…</p>}
        {!loading && !messages.length && !error && (
          <p className="text-mut text-sm text-center">No messages yet. Say hello to {contact.name}.</p>
        )}
        {error && <p className="text-red text-sm text-center" role="alert">{error}</p>}
        {messages.map((m) => {
          const mine = m.sender_id === me;
          return (
            <div key={m.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[80%] rounded-2xl px-3.5 py-2 text-sm ${mine ? 'bg-teal text-white' : 'bg-white border border-line'}`}>
                <div className="whitespace-pre-wrap break-words">{m.body}</div>
                <div className={`mt-1 flex items-center gap-2 text-[11px] ${mine ? 'text-white/80 justify-end' : 'text-mut'}`}>
                  <span>{fmt(m.created_at)}</span>
                  {mine && <Status m={m} />}
                  {m.local === 'failed' && (
                    <button type="button" onClick={() => deliver(m)} className="inline-flex items-center gap-1 underline">
                      <LuRotateCw size={11} /> Retry
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
        <div ref={bottom} />
      </div>
      <form onSubmit={submit} className="flex gap-2 mt-2">
        <input
          value={text} onChange={(e) => setText(e.target.value)} maxLength={2000}
          aria-label={`Message ${contact.name}`} placeholder={`Message ${contact.name}`}
          className="flex-1 px-3 py-2.5 rounded-lg border border-line text-sm focus:outline-none focus:border-teal focus:ring-2 focus:ring-teal/20"
        />
        <button type="submit" disabled={!text.trim()} aria-label="Send message"
          className="w-11 h-11 grid place-items-center rounded-lg bg-teal text-white disabled:opacity-50">
          <LuSend size={16} />
        </button>
      </form>
    </div>
  );
}
