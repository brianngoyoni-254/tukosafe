import { useState } from 'react';
import { LuUserPlus, LuCheck, LuX, LuMessageCircle, LuUserMinus, LuBan, LuMail, LuChevronDown } from 'react-icons/lu';
import * as api from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { useData } from '../context/DataContext';
import { useApp } from '../context/app-context';
import Card from './ui/Card';
import Button from './ui/Button';
import Toggle from './ui/Toggle';
import Chat from './Chat';

export default function TrustCircle() {
  const { contacts, invitations, blocked, unread, refreshTrust, loadError, realtime } = useData();
  const { showToast } = useApp();
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState('');
  const [openChat, setOpenChat] = useState(null);
  const [expanded, setExpanded] = useState(null);
  const [formError, setFormError] = useState('');

  const act = async (key, fn, okMsg) => {
    setBusy(key);
    try { await fn(); if (okMsg) showToast(okMsg); await refreshTrust(); }
    catch (e) { showToast(e.message); }
    finally { setBusy(''); }
  };

  const invite = async (e) => {
    e.preventDefault();
    setFormError('');
    setBusy('invite');
    try {
      await api.sendInvitation(email);
      setEmail('');
      showToast('Invitation sent. They will see it in their own account.');
      await refreshTrust();
    } catch (err) { setFormError(err.message); } finally { setBusy(''); }
  };

  return (
    <div className="space-y-3.5">
      <Card>
        <div className="flex items-center justify-between gap-2">
          <b>Invite a trusted friend</b>
          <span className={`text-xs ${realtime === 'live' ? 'text-green' : 'text-mut'}`}>
            {realtime === 'live' ? '● Live' : realtime === 'offline' ? '○ Offline' : '○ Connecting…'}
          </span>
        </div>
        <p className="text-mut text-sm mt-1">They must have a TukoSafe account (or will see the invitation when they sign up). Being a trusted friend does not share your location.</p>
        <form onSubmit={invite} className="flex gap-2 mt-3">
          <input type="email" required value={email} onChange={(e) => { setEmail(e.target.value); setFormError(''); }}
            aria-label="Friend's email" placeholder="friend@example.com"
            className="flex-1 min-w-0 px-3 py-2.5 rounded-lg border border-line text-sm focus:outline-none focus:border-teal focus:ring-2 focus:ring-teal/20" />
          <Button type="submit" size="sm" disabled={busy === 'invite'}><LuUserPlus size={15} /> {busy === 'invite' ? 'Sending…' : 'Invite'}</Button>
        </form>
        {formError && <p className="text-red text-sm mt-2" role="alert">{formError}</p>}
      </Card>

      <InvitationList invitations={invitations} act={act} busy={busy} />

      <Card>
        <b>Trusted friends ({contacts.length})</b>
        {loadError && <p className="text-red text-sm mt-1" role="alert">{loadError}</p>}
        {!contacts.length && <p className="text-mut text-sm mt-2">No trusted friends yet. Send an invitation above; once they accept, they appear here for both of you.</p>}
        {contacts.map((c) => (
          <div key={c.id} className="border-t border-line first:border-t-0 mt-2.5 pt-2.5">
            <div className="flex items-center gap-3">
              <span className="w-9 h-9 rounded-full bg-mint text-deep grid place-items-center font-bold shrink-0">{c.name[0]?.toUpperCase()}</span>
              <div className="min-w-0 flex-1">
                <b className="block truncate">{c.name}</b>
                <span className="text-mut text-xs block truncate">{c.email}</span>
              </div>
              <button type="button" onClick={() => setOpenChat(openChat === c.id ? null : c.id)}
                className="relative w-10 h-10 grid place-items-center rounded-lg border border-line hover:bg-mint" aria-label={`Message ${c.name}`}>
                <LuMessageCircle size={17} />
                {unread[c.id] > 0 && (
                  <span className="absolute -top-1 -right-1 min-w-5 h-5 px-1 rounded-full bg-red text-white text-[11px] font-bold grid place-items-center">{unread[c.id]}</span>
                )}
              </button>
              <button type="button" onClick={() => setExpanded(expanded === c.id ? null : c.id)} aria-expanded={expanded === c.id}
                className="w-10 h-10 grid place-items-center rounded-lg border border-line hover:bg-mint" aria-label={`Manage ${c.name}`}>
                <LuChevronDown size={16} className={expanded === c.id ? 'rotate-180' : ''} />
              </button>
            </div>
            {expanded === c.id && (
              <div className="mt-3 p-3 rounded-xl bg-[#f4f8f7] space-y-2.5">
                <p className="text-xs text-mut m-0">Trusted since {new Date(c.since).toLocaleDateString()}. {c.phone ? `Phone: ${c.phone}.` : ''}</p>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm">Receives my SOS alerts</span>
                  <Toggle checked={c.receivesSos} label={`${c.name} receives SOS`}
                    onChange={(v) => act(`p${c.id}`, () => api.updateContactPrefs(c.id, v, c.receivesCheckins))} />
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm">Receives my check-in updates</span>
                  <Toggle checked={c.receivesCheckins} label={`${c.name} receives check-ins`}
                    onChange={(v) => act(`p${c.id}`, () => api.updateContactPrefs(c.id, c.receivesSos, v))} />
                </div>
                <p className="text-xs text-mut m-0">Location is never shared by default. Start sharing on the Live map.</p>
                <div className="flex flex-wrap gap-2">
                  <Button variant="outline" size="sm" disabled={busy === `r${c.id}`}
                    onClick={() => window.confirm(`Remove ${c.name}? This also stops any location sharing between you.`)
                      && act(`r${c.id}`, () => api.removeContact(c.id), `${c.name} removed.`)}>
                    <LuUserMinus size={15} /> Remove
                  </Button>
                  <Button variant="outline" size="sm" disabled={busy === `b${c.id}`}
                    onClick={() => window.confirm(`Block ${c.name}? They can no longer message you or see anything of yours.`)
                      && act(`b${c.id}`, () => api.blockUser(c.id), `${c.name} blocked.`)}>
                    <LuBan size={15} /> Block
                  </Button>
                </div>
              </div>
            )}
            {openChat === c.id && <div className="mt-3"><Chat contact={c} /></div>}
          </div>
        ))}
      </Card>

      {blocked.length > 0 && (
        <Card>
          <b>Blocked ({blocked.length})</b>
          {blocked.map((b) => (
            <div key={b.id} className="flex items-center justify-between gap-3 mt-2">
              <span className="text-sm">{b.display_name}</span>
              <Button variant="outline" size="sm" disabled={busy === `u${b.id}`}
                onClick={() => act(`u${b.id}`, () => api.unblockUser(b.id), `${b.display_name} unblocked.`)}>Unblock</Button>
            </div>
          ))}
        </Card>
      )}
    </div>
  );
}

function InvitationList({ invitations, act, busy }) {
  const { user } = useAuth();
  const incoming = invitations.filter((i) => i.invitee_id === user.id);
  const outgoing = invitations.filter((i) => i.inviter_id === user.id);
  if (!incoming.length && !outgoing.length) return null;
  return (
    <Card>
      <b>Invitations</b>
      {incoming.map((i) => (
        <div key={i.id} className="flex items-center gap-3 mt-2.5 flex-wrap">
          <LuMail size={16} className="text-amber shrink-0" />
          <span className="flex-1 min-w-[140px] text-sm"><b>{i.inviter?.display_name || 'Someone'}</b> wants to be your trusted friend</span>
          <Button size="sm" disabled={busy === `a${i.id}`} onClick={() => act(`a${i.id}`, () => api.respondInvitation(i.id, true), 'You are now trusted friends.')}><LuCheck size={15} /> Accept</Button>
          <Button size="sm" variant="outline" disabled={busy === `d${i.id}`} onClick={() => act(`d${i.id}`, () => api.respondInvitation(i.id, false), 'Invitation declined.')}><LuX size={15} /> Reject</Button>
        </div>
      ))}
      {outgoing.map((i) => (
        <div key={i.id} className="flex items-center gap-3 mt-2.5 flex-wrap">
          <LuMail size={16} className="text-mut shrink-0" />
          <span className="flex-1 min-w-[140px] text-sm">Sent to <b>{i.invitee_email}</b> · pending</span>
          <Button size="sm" variant="outline" disabled={busy === `c${i.id}`} onClick={() => act(`c${i.id}`, () => api.cancelInvitation(i.id), 'Invitation cancelled.')}>Cancel</Button>
        </div>
      ))}
    </Card>
  );
}
