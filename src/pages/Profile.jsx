import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import * as api from '../lib/api';
import { currentSubscription, enablePush, disablePush, pushSupported, pushConfigured } from '../lib/push';
import Toggle from '../components/ui/Toggle';
import { useAuth } from '../context/AuthContext';
import { useApp } from '../context/AppContext';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';

const INPUT = 'w-full px-3 py-2.5 rounded-lg border border-line bg-white text-sm focus:outline-none focus:border-teal focus:ring-2 focus:ring-teal/20';

export default function Profile() {
  const { user, updateProfile, changePassword, logout, deleteAccount } = useAuth();
  const { showToast } = useApp();
  const navigate = useNavigate();
  const [name, setName] = useState(user.name);
  const [phone, setPhone] = useState(user.phone || '');
  const [cur, setCur] = useState('');
  const [next, setNext] = useState('');
  const [msg, setMsg] = useState({ profile: '', password: '' });
  const perm = typeof Notification === 'undefined' ? 'unsupported' : Notification.permission;
  const [prefs, setPrefsState] = useState({ push: true, email: false, sms: false });
  const [pushOn, setPushOn] = useState(false);
  const [chanMsg, setChanMsg] = useState('');

  useEffect(() => {
    let alive = true;
    api.fetchPrefs(user.id).then((p) => { if (alive) setPrefsState(p); }).catch(() => {});
    currentSubscription().then((s) => { if (alive) setPushOn(!!s); }).catch(() => {});
    return () => { alive = false; };
  }, [user.id]);

  const savePrefs = async (next) => {
    setChanMsg('');
    try {
      await api.setPrefs(next);
      setPrefsState(next);
      setChanMsg('Saved. Whether a message actually reaches you depends on the provider being set up on the server.');
    } catch (e) { setChanMsg(e.message); }
  };

  const togglePush = async (on) => {
    setChanMsg('');
    try {
      if (on) { await enablePush(); setPushOn(true); setChanMsg('Push enabled on this device.'); }
      else { await disablePush(); setPushOn(false); setChanMsg('Push disabled on this device.'); }
    } catch (e) { setChanMsg(e.message); }
  };

  const saveProfile = async (e) => {
    e.preventDefault();
    const r = await updateProfile({ name, phone });
    setMsg((m) => ({ ...m, profile: r.ok ? 'Saved.' : r.error }));
  };
  const savePassword = async (e) => {
    e.preventDefault();
    const r = await changePassword({ current: cur, next });
    setMsg((m) => ({ ...m, password: r.ok ? 'Password updated.' : r.error }));
    if (r.ok) { setCur(''); setNext(''); }
  };
  const remove = async () => {
    if (!window.confirm('Permanently delete your account and all data? This cannot be undone.')) return;
    const r = await deleteAccount();
    if (r.ok) { showToast('Account deleted.'); navigate('/'); } else showToast(r.error);
  };

  return (
    <div className="max-w-[640px] mx-auto px-5 py-10 space-y-4">
      <h1 className="font-display font-extrabold text-3xl">Profile and settings</h1>
      <Card>
        <b>Your details</b>
        <form onSubmit={saveProfile} className="space-y-3 mt-3">
          <label className="block text-sm font-bold">Name<input className={`${INPUT} mt-1 font-normal`} value={name} onChange={(e) => setName(e.target.value)} required minLength={2} /></label>
          <label className="block text-sm font-bold">Phone<input className={`${INPUT} mt-1 font-normal`} value={phone} onChange={(e) => setPhone(e.target.value)} type="tel" /></label>
          <p className="text-mut text-sm m-0">Email: {user.email}{user.emailConfirmed ? ' (verified)' : ' (not verified)'}</p>
          <Button type="submit" size="sm">Save</Button>
          {msg.profile && <span className="text-sm ml-3" role="status">{msg.profile}</span>}
        </form>
      </Card>
      <Card>
        <b>Change password</b>
        <form onSubmit={savePassword} className="space-y-3 mt-3">
          <input className={INPUT} type="password" autoComplete="current-password" placeholder="Current password" aria-label="Current password" value={cur} onChange={(e) => setCur(e.target.value)} required />
          <input className={INPUT} type="password" autoComplete="new-password" placeholder="New password (8+ characters)" aria-label="New password" value={next} onChange={(e) => setNext(e.target.value)} required minLength={8} />
          <Button type="submit" size="sm">Update password</Button>
          {msg.password && <span className="text-sm ml-3" role="status">{msg.password}</span>}
        </form>
      </Card>
      <Card>
        <b>How you are notified</b>
        <p className="text-mut text-sm mt-1">
          In-app notifications are always on. The options below add extra channels. Delivery is best effort and a provider
          accepting a message does not prove you saw it.
        </p>
        <ul className="list-none p-0 m-0 space-y-3 text-sm">
          <li className="flex items-start justify-between gap-3">
            <span>
              <b>Browser push (this device)</b>
              <span className="block text-mut text-xs">
                {!pushSupported() ? 'Not supported in this browser.'
                  : !pushConfigured() ? 'Not available: the app has no push key configured.'
                  : perm === 'denied' ? 'Blocked in browser settings. Allow notifications for this site, then try again.'
                  : 'May be delayed or dropped by your browser or phone (battery savers, Do Not Disturb, being offline).'}
              </span>
            </span>
            <Toggle checked={pushOn} label="Browser push on this device" onChange={togglePush} />
          </li>
          <li className="flex items-start justify-between gap-3">
            <span>
              <b>Email for critical alerts</b>
              <span className="block text-mut text-xs">SOS, help requests and missed check-ins, sent to {user.email}.</span>
            </span>
            <Toggle checked={prefs.email} label="Email for critical alerts" onChange={(v) => savePrefs({ ...prefs, email: v })} />
          </li>
          <li className="flex items-start justify-between gap-3">
            <span>
              <b>SMS for critical alerts</b>
              <span className="block text-mut text-xs">
                {user.phone ? `Sent to ${user.phone}. Standard SMS charges may apply to the sender's provider.` : 'Add a phone number above first.'}
              </span>
            </span>
            <Toggle checked={prefs.sms} label="SMS for critical alerts" onChange={(v) => savePrefs({ ...prefs, sms: v })} />
          </li>
        </ul>
        {chanMsg && <p className="text-sm mt-3 mb-0" role="status">{chanMsg}</p>}
      </Card>
      <Card>
        <div className="flex flex-wrap gap-2.5">
          <Button variant="outline" onClick={async () => { await logout(); navigate('/'); }}>Sign out</Button>
          <Button variant="danger" onClick={remove}>Delete my account</Button>
        </div>
      </Card>
    </div>
  );
}
