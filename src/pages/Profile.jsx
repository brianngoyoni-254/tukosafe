import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
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
  const [perm, setPerm] = useState(typeof Notification === 'undefined' ? 'unsupported' : Notification.permission);

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
  const enableBrowserAlerts = async () => setPerm(await Notification.requestPermission());
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
        <b>Browser notifications</b>
        <p className="text-mut text-sm mt-1">Shown while TukoSafe is open in a background tab. This is not a push service: nothing arrives when the app is closed.</p>
        {perm === 'unsupported' && <p className="text-sm">Not supported in this browser.</p>}
        {perm === 'granted' && <p className="text-sm text-green">Enabled.</p>}
        {perm === 'denied' && <p className="text-sm">Blocked. Allow notifications for this site in your browser settings.</p>}
        {perm === 'default' && <Button size="sm" variant="outline" onClick={enableBrowserAlerts}>Enable</Button>}
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
