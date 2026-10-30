import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { LuMail, LuLock, LuEye, LuEyeOff, LuCircleAlert, LuCircleCheck } from 'react-icons/lu';
import { useAuth } from '../context/AuthContext';

const INPUT = 'w-full pl-10 pr-3 py-2.5 rounded-lg border border-line bg-white text-ink font-body text-sm focus:outline-none focus:border-teal focus:ring-2 focus:ring-teal/20 transition';
const BTN = 'w-full inline-flex items-center justify-center gap-2 h-11 rounded-lg bg-teal text-white font-bold text-sm hover:brightness-110 disabled:opacity-60 transition';

function Shell({ title, subtitle, error, children }) {
  return (
    <div className="min-h-[calc(100vh-4rem)] grid place-items-center p-5 bg-[#f4f8f7]">
      <div className="w-full max-w-[420px] bg-white rounded-2xl p-6 sm:p-8 border border-line shadow-[0_18px_50px_rgba(7,39,36,0.1)]">
        <h2 className="font-display font-extrabold text-2xl mb-1">{title}</h2>
        <p className="text-mut text-sm mb-6">{subtitle}</p>
        {error && (
          <div className="mb-4 p-3 rounded-lg bg-redbg text-red text-sm font-medium border border-red/20 flex items-start gap-2" role="alert">
            <LuCircleAlert size={16} className="mt-0.5 shrink-0" /><span>{error}</span>
          </div>
        )}
        {children}
      </div>
    </div>
  );
}

export function ForgotPassword() {
  const { requestPasswordReset, error, clearError } = useAuth();
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    const r = await requestPasswordReset(email);
    setBusy(false);
    if (r.ok) setSent(true);
  };

  if (sent) {
    return (
      <Shell title="Check your email" subtitle="If an account exists for that address, a reset link is on its way.">
        <p className="flex items-center gap-2 text-sm text-green mb-4" role="status"><LuCircleCheck size={16} /> Request received.</p>
        <Link to="/login" className="text-teal font-bold text-sm hover:underline">Back to sign in</Link>
      </Shell>
    );
  }
  return (
    <Shell title="Reset your password" subtitle="Enter your email and we will send you a reset link." error={error}>
      <form onSubmit={submit} className="space-y-4">
        <div className="relative">
          <LuMail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-mut pointer-events-none" />
          <input type="email" required autoComplete="email" aria-label="Email" placeholder="you@example.com"
            value={email} onChange={(e) => { setEmail(e.target.value); clearError(); }} className={INPUT} />
        </div>
        <button type="submit" disabled={busy} className={BTN}>{busy ? 'Sending…' : 'Send reset link'}</button>
      </form>
      <p className="text-center text-sm mt-5"><Link to="/login" className="text-teal font-bold hover:underline">Back to sign in</Link></p>
    </Shell>
  );
}

export function ResetPassword() {
  const { recovery, isAuthenticated, loading, setNewPassword, error, clearError } = useAuth();
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);

  if (loading) return <Shell title="Reset your password" subtitle="Checking your link…" />;
  if (!recovery && !isAuthenticated) {
    return (
      <Shell title="Link expired" subtitle="This reset link is invalid or has expired.">
        <Link to="/forgot-password" className="text-teal font-bold text-sm hover:underline">Request a new link</Link>
      </Shell>
    );
  }

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    const r = await setNewPassword(password);
    setBusy(false);
    if (r.ok) navigate('/', { replace: true });
  };

  return (
    <Shell title="Choose a new password" subtitle="At least 8 characters." error={error}>
      <form onSubmit={submit} className="space-y-4">
        <div className="relative">
          <LuLock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-mut pointer-events-none" />
          <input type={show ? 'text' : 'password'} required minLength={8} autoComplete="new-password" aria-label="New password"
            value={password} onChange={(e) => { setPassword(e.target.value); clearError(); }} className={`${INPUT} pr-10`} />
          <button type="button" onClick={() => setShow((v) => !v)} aria-label={show ? 'Hide password' : 'Show password'}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-mut hover:text-ink p-1 rounded">
            {show ? <LuEyeOff size={16} /> : <LuEye size={16} />}
          </button>
        </div>
        <button type="submit" disabled={busy} className={BTN}>{busy ? 'Saving…' : 'Update password'}</button>
      </form>
    </Shell>
  );
}
