import { useState } from 'react';
import { LuCheck, LuClock, LuUserPlus } from 'react-icons/lu';
import { useApp } from '../context/app-context';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import Chip from '../components/ui/Chip';
import Toggle from '../components/ui/Toggle';
import { CONTACTS } from '../data/dummy';

export default function Contacts() {
  const { notify, setNotify, showToast } = useApp();
  const [people, setPeople] = useState(CONTACTS);
  const [newName, setNewName] = useState('');

  const add = () => {
    const n = newName.trim().slice(0, 24);
    if (!n) return showToast('Type a name first.');
    setPeople((p) => [...p, { id: Date.now(), name: n, joined: false, avatar: n[0] }]);
    setNewName('');
    showToast(`Invite sent to ${n} (simulated).`);
  };

  const joined = people.filter((p) => p.joined);

  return (
    <>
      <div className="relative overflow-hidden bg-deep text-white pt-11 pb-20">
        <div className="max-w-[1120px] mx-auto px-5 relative">
          <span className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border border-white/20 text-white/90 text-sm mb-3">
            <span className="w-2 h-2 rounded-full bg-amber animate-[blink_1.6s_infinite]" />
            Trusted circle
          </span>
          <h2 className="font-display font-extrabold text-[clamp(2rem,5vw,3.3rem)] text-white mb-2">Who looks out for you</h2>
          <p className="text-white/90 max-w-[58ch] m-0">Choose who sees your status and who is told first if you go quiet.</p>
        </div>
      </div>
      <div className="max-w-[1120px] mx-auto px-5 -mt-11 relative">
        <div className="grid lg:grid-cols-[1.5fr_1fr] gap-5 items-start">
          <div>
            <Card>
              <div className="flex justify-between items-center gap-3 flex-wrap mb-2">
                <b>Your circle</b>
                <Chip>{people.length} contacts</Chip>
              </div>
              {people.map((m) => (
                <div key={m.id} className="flex items-center justify-between gap-3 py-2.5 border-t border-line first:border-0 flex-wrap">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-accent text-white grid place-items-center font-bold">{m.avatar}</div>
                    <div>
                      <b>{m.name}</b>
                      <div className="flex gap-1.5 mt-0.5">
                        {m.joined ? <Chip tone="g"><LuCheck size={12} /> Joined</Chip> : <Chip tone="n"><LuClock size={12} /> Invite pending</Chip>}
                        {m.name === notify && <Chip tone="y">Told first</Chip>}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2.5 text-mut text-sm">
                    Consent
                    <Toggle
                      checked={m.joined}
                      onChange={(v) => setPeople((arr) => arr.map((x) => (x.id === m.id ? { ...x, joined: v } : x)))}
                      label={`Consent for ${m.name}`}
                    />
                    <Button size="sm" variant="outline" onClick={() => setPeople((arr) => arr.filter((x) => x.id !== m.id))}>
                      Remove
                    </Button>
                  </div>
                </div>
              ))}
              {people.length === 0 && <p className="text-mut">No contacts yet.</p>}
            </Card>

            <Card>
              <b>Add a trusted friend</b>
              <p className="text-mut text-sm">They get an invite and must accept before they can see anything.</p>
              <div className="flex flex-wrap gap-2.5 mt-2">
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="Friend’s name"
                  aria-label="Friend’s name"
                  className="flex-1 min-w-[180px] p-2.5 rounded-lg border border-line bg-surface text-ink font-body"
                />
                <Button onClick={add}><LuUserPlus size={16} /> Send invite</Button>
              </div>
            </Card>
          </div>

          <div className="space-y-3.5">
            <Card>
              <b>Who is told first</b>
              <p className="text-mut text-sm mt-1">This friend gets the alert if a check-in is missed, and the “I’m home” message.</p>
              <select
                aria-label="Who is told first"
                value={notify}
                onChange={(e) => setNotify(e.target.value)}
                className="w-full mt-2 p-2.5 rounded-lg border border-line bg-surface text-ink font-body"
              >
                {joined.length === 0 && <option>No one has joined yet</option>}
                {joined.map((p) => <option key={p.id} value={p.name}>{p.name}</option>)}
              </select>
            </Card>
            <Card>
              <b>What your friends can see</b>
              <p className="text-mut text-sm mt-1">
                Your status and last known location, only during an outing and only until sharing ends.
                Anyone can leave any time. Nothing is shared with responders.
              </p>
            </Card>
            <Button to="/outing" variant="outline">Back to the outing</Button>
          </div>
        </div>
      </div>
    </>
  );
}