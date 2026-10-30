import { useState } from 'react';
import { Link } from 'react-router-dom';
import { LuCheck, LuUserPlus } from 'react-icons/lu';
import * as api from '../lib/api';
import { useApp } from '../context/app-context';
import { useData } from '../context/DataContext';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import Chip from '../components/ui/Chip';
import Toggle from '../components/ui/Toggle';

export default function Contacts() {
  const { contacts, invitations, refreshTrust, loadError } = useData();
  const { showToast } = useApp();
  const [busy, setBusy] = useState('');

  const setPrefs = async (c, sos, checkins) => {
    setBusy(c.id);
    try { await api.updateContactPrefs(c.id, sos, checkins); await refreshTrust(); }
    catch (e) { showToast(e.message); } finally { setBusy(''); }
  };

  const alertable = contacts.filter((c) => c.receivesSos || c.receivesCheckins);

  return (
    <>
      <div className="relative overflow-hidden bg-deep text-white pt-11 pb-20">
        <div className="max-w-[1120px] mx-auto px-5 relative">
          <span className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border border-white/20 text-[#bfe0da] text-sm mb-3">
            <span className="w-2 h-2 rounded-full bg-amber animate-[blink_1.6s_infinite]" />
            Trusted circle
          </span>
          <h2 className="font-display font-extrabold text-[clamp(2rem,5vw,3.3rem)] text-white mb-2">Who looks out for you</h2>
          <p className="text-[#bfe0da] max-w-[58ch] m-0">Choose who is told if you press SOS or miss a check-in.</p>
        </div>
      </div>
      <div className="max-w-[1120px] mx-auto px-5 -mt-11 relative">
        <div className="grid lg:grid-cols-[1.5fr_1fr] gap-5 items-start">
          <Card>
            <div className="flex justify-between items-center gap-3 flex-wrap mb-2">
              <b>Your circle</b>
              <Chip>{contacts.length} trusted friend{contacts.length === 1 ? '' : 's'}</Chip>
            </div>
            {loadError && <p className="text-red text-sm" role="alert">{loadError}</p>}
            {contacts.map((c) => (
              <div key={c.id} className="flex items-center justify-between gap-3 py-2.5 border-t border-line first:border-0 flex-wrap">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-teal text-white grid place-items-center font-bold">{c.name[0]}</div>
                  <div>
                    <Link to={`/contact?with=${c.id}`} className="font-bold text-ink">{c.name}</Link>
                    <div className="flex gap-1.5 mt-0.5">
                      <Chip tone="g"><LuCheck size={12} /> Accepted</Chip>
                      {c.receivesSos && <Chip tone="y">Told if SOS</Chip>}
                      {c.receivesCheckins && <Chip tone="y">Told if I miss a check-in</Chip>}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-4 text-mut text-sm">
                  <span className="flex items-center gap-2">SOS <Toggle checked={c.receivesSos} label={`${c.name} receives SOS`} onChange={(v) => busy !== c.id && setPrefs(c, v, c.receivesCheckins)} /></span>
                  <span className="flex items-center gap-2">Check-ins <Toggle checked={c.receivesCheckins} label={`${c.name} receives check-ins`} onChange={(v) => busy !== c.id && setPrefs(c, c.receivesSos, v)} /></span>
                </div>
              </div>
            ))}
            {!contacts.length && (
              <p className="text-mut m-0">
                No trusted friends yet. {invitations.length ? `You have ${invitations.length} pending invitation${invitations.length > 1 ? 's' : ''}.` : ''}
              </p>
            )}
            <Button to="/trust" variant="outline" size="sm" className="mt-3"><LuUserPlus size={15} /> Invite or manage friends</Button>
          </Card>

          <div className="space-y-3.5">
            <Card>
              <b>Who is told</b>
              <p className="text-mut text-sm mt-1 mb-0">
                {alertable.length
                  ? `${alertable.map((c) => c.name).join(', ')} will be alerted about SOS or missed check-ins as set on the left.`
                  : 'Nobody is set to receive your alerts. Turn on SOS or check-in alerts for at least one friend.'}
              </p>
            </Card>
            <Card>
              <b>What your friends can see</b>
              <p className="text-mut text-sm mt-1 mb-0">
                Being a trusted friend shares nothing by itself. Location is shared only when you start sharing with a named
                friend, for a set time, and you can stop at any moment. Nothing is shared with responders.
              </p>
            </Card>
            <Button to="/outing" variant="outline">Back to the outing</Button>
          </div>
        </div>
      </div>
    </>
  );
}
