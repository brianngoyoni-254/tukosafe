import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  LuMail, LuLock, LuEye, LuEyeOff, LuUser, LuPhone, LuArrowRight,
  LuShieldCheck, LuUsers, LuCircleAlert,
} from 'react-icons/lu';
import { useAuth } from '../context/AuthContext';

function strength(pw) {
  if (!pw) return { score: 0, label: 'Enter a password', color: 'bg-line' };
  let s = 0;
  if (pw.length >= 6) s++;
  if (pw.length >= 10) s++;
  if (/[A-Z]/.test(pw)) s++;
  if (/[0-9]/.test(pw)) s++;
  if (/[^A-Za-z0-9]/.test(pw)) s++;
  const map = [
    { label: 'Too short', color: 'bg-red' },
    { label: 'Weak', color: 'bg-red' },
    { label: 'Fair', color: 'bg-amber' },
    { label: 'Good', color: 'bg-teal2' },
    { label: 'Strong', color: 'bg-green' },
    { label: 'Excellent', color: 'bg-green' },
  ];
  return { score: s, ...map[Math.min(s, 5)] };
}

export default function Signup() {
  const { signup, resendVerification, error, clearError } = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [agree, setAgree] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const pwStrength = strength(password);
  const pwPct = (pwStrength.score / 5) * 100;

  const [verifyEmail, setVerifyEmail] = useState('');
  const [resent, setResent] = useState('');

  const submit = async (e) => {
    e.preventDefault();
    if (!agree) return;
    setSubmitting(true);
    const result = await signup({ name, email, phone, password });
    setSubmitting(false);
    if (!result.ok) return;
    if (result.needsVerification) setVerifyEmail(result.email);
    else navigate('/', { replace: true });
  };

  const resend = async () => {
    const r = await resendVerification(verifyEmail);
    setResent(r.ok ? 'Verification email sent again.' : r.error);
  };

  if (verifyEmail) {
    return (
      <div className="min-h-[calc(100vh-4rem)] grid place-items-center p-5 bg-[#f4f8f7]">
        <div className="w-full max-w-[420px] bg-white rounded-2xl p-8 border border-line shadow-[0_18px_50px_rgba(7,39,36,0.1)] text-center">
          <LuMail size={32} className="mx-auto text-teal mb-3" />
          <h2 className="font-display font-extrabold text-2xl mb-2">Check your email</h2>
          <p className="text-mut text-sm mb-4">
            We sent a confirmation link to <b>{verifyEmail}</b>. Open it, then sign in.
          </p>
          {resent && <p className="text-sm mb-3" role="status">{resent}</p>}
          <button type="button" onClick={resend} className="text-teal font-bold text-sm hover:underline mr-4">Resend email</button>
          <Link to="/login" className="text-teal font-bold text-sm hover:underline">Go to sign in</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[calc(100vh-4rem)] grid lg:grid-cols-2">
      {/* Left: Brand panel */}
      <div className="hidden lg:flex relative overflow-hidden bg-deep text-white p-12 flex-col justify-between order-2 lg:order-1">
        <div>
          <Link to="/" className="inline-flex items-center gap-3 text-white no-underline">
            <span className="w-9 h-9 rounded-[50%_50%_50%_4px] bg-amber -rotate-45 inline-block" />
            <span className="font-display font-extrabold text-2xl tracking-tight">TukoSafe</span>
          </Link>
        </div>
        <div className="relative z-10">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border border-white/20 text-[#bfe0da] text-sm mb-6">
            <span className="w-2 h-2 rounded-full bg-amber animate-[blink_1.6s_infinite]" />
            People First, AI Second
          </div>
          <h1 className="font-display font-extrabold text-[clamp(2.2rem,4.5vw,3.6rem)] leading-[1.05] mb-5">
            One circle.<br />One night.<br />
            <span className="text-amber">Everyone home.</span>
          </h1>
          <p className="text-[#bfe0da] text-lg max-w-[42ch]">
            Create your account and build a trusted circle who looks out for you on nights out.
          </p>
          <div className="mt-8 space-y-3 max-w-[440px]">
            {[
              [LuUsers, 'Your circle decides who sees what'],
              [LuShieldCheck, 'AI drafts, you approve, people act'],
              [LuCircleAlert, 'SOS and 999 / 112 always work'],
            ].map(([Icon, label]) => (
              <div key={label} className="flex items-center gap-3 p-3 rounded-xl bg-white/5 border border-white/10">
                <Icon size={18} className="text-amber shrink-0" />
                <span className="text-sm text-[#bfe0da]">{label}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="relative z-10 text-sm text-[#8fb9b2]">
          From the Swahili <i>tuko salama</i> — “we are safe”.
        </div>
        <div className="absolute -left-40 -bottom-40 w-[480px] h-[480px] rounded-full border border-teal2/20 animate-[pulse-ring_8s_ease-out_infinite]" />
        <div className="absolute -left-20 -bottom-20 w-[320px] h-[320px] rounded-full border border-teal2/15 animate-[pulse-ring_8s_ease-out_infinite_2s]" />
      </div>

      {/* Right: Form */}
      <div className="flex items-center justify-center p-5 sm:p-10 bg-[#f4f8f7] order-1 lg:order-2">
        <div className="w-full max-w-[440px]">
          <div className="lg:hidden text-center mb-8">
            <Link to="/" className="inline-flex items-center gap-2.5 text-ink no-underline">
              <span className="w-8 h-8 rounded-[50%_50%_50%_4px] bg-amber -rotate-45 inline-block" />
              <span className="font-display font-extrabold text-xl">TukoSafe</span>
            </Link>
          </div>

          <div className="bg-white rounded-2xl p-6 sm:p-8 shadow-[0_18px_50px_rgba(7,39,36,0.1)] border border-line">
            <h2 className="font-display font-extrabold text-2xl mb-1">Create your account</h2>
            <p className="text-mut text-sm mb-6">Your data stays in this browser. Nothing is sent to a server.</p>

            {error && (
              <div className="mb-4 p-3 rounded-lg bg-redbg text-red text-sm font-medium border border-red/20" role="alert">
                {error}
              </div>
            )}

            <form onSubmit={submit} className="space-y-4">
              <div>
                <label htmlFor="name" className="block text-sm font-bold mb-1.5">Full name</label>
                <div className="relative">
                  <LuUser size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-mut pointer-events-none" />
                  <input
                    id="name"
                    type="text"
                    autoComplete="name"
                    value={name}
                    onChange={(e) => { setName(e.target.value); clearError(); }}
                    placeholder="Wanjiru Kamau"
                    className="w-full pl-10 pr-3 py-2.5 rounded-lg border border-line bg-white text-ink font-body text-sm focus:outline-none focus:border-teal focus:ring-2 focus:ring-teal/20 transition"
                    required
                    maxLength={60}
                  />
                </div>
              </div>

              <div>
                <label htmlFor="email" className="block text-sm font-bold mb-1.5">Email</label>
                <div className="relative">
                  <LuMail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-mut pointer-events-none" />
                  <input
                    id="email"
                    type="email"
                    autoComplete="email"
                    value={email}
                    onChange={(e) => { setEmail(e.target.value); clearError(); }}
                    placeholder="you@example.com"
                    className="w-full pl-10 pr-3 py-2.5 rounded-lg border border-line bg-white text-ink font-body text-sm focus:outline-none focus:border-teal focus:ring-2 focus:ring-teal/20 transition"
                    required
                  />
                </div>
              </div>

              <div>
                <label htmlFor="phone" className="block text-sm font-bold mb-1.5">
                  Phone <span className="text-mut font-normal">(optional)</span>
                </label>
                <div className="relative">
                  <LuPhone size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-mut pointer-events-none" />
                  <input
                    id="phone"
                    type="tel"
                    autoComplete="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+254 700 000 000"
                    className="w-full pl-10 pr-3 py-2.5 rounded-lg border border-line bg-white text-ink font-body text-sm focus:outline-none focus:border-teal focus:ring-2 focus:ring-teal/20 transition"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="password" className="block text-sm font-bold mb-1.5">Password</label>
                <div className="relative">
                  <LuLock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-mut pointer-events-none" />
                  <input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="new-password"
                    value={password}
                    onChange={(e) => { setPassword(e.target.value); clearError(); }}
                    placeholder="At least 8 characters"
                    className="w-full pl-10 pr-10 py-2.5 rounded-lg border border-line bg-white text-ink font-body text-sm focus:outline-none focus:border-teal focus:ring-2 focus:ring-teal/20 transition"
                    required
                    minLength={8}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-mut hover:text-ink p-1 rounded"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <LuEyeOff size={16} /> : <LuEye size={16} />}
                  </button>
                </div>
                {password && (
                  <div className="mt-2">
                    <div className="h-1.5 rounded-full bg-line overflow-hidden">
                      <div className={`h-full ${pwStrength.color} transition-all duration-300`} style={{ width: `${pwPct}%` }} />
                    </div>
                    <p className="text-xs text-mut mt-1">{pwStrength.label}</p>
                  </div>
                )}
              </div>

              <label className="flex items-start gap-2.5 cursor-pointer pt-1">
                <input
                  type="checkbox"
                  checked={agree}
                  onChange={(e) => setAgree(e.target.checked)}
                  className="w-[18px] h-[18px] accent-teal shrink-0 mt-0.5"
                />
                <span className="text-xs text-mut leading-relaxed">
                  I understand TukoSafe notifies my trusted friends and is not an emergency service.
                  In an emergency I will call 999 or 112.
                </span>
              </label>

              <button
                type="submit"
                disabled={submitting || !agree}
                className="w-full inline-flex items-center justify-center gap-2 h-11 rounded-lg bg-teal text-white font-bold text-sm hover:brightness-110 disabled:opacity-60 disabled:cursor-not-allowed transition"
              >
                {submitting ? 'Creating account…' : 'Create account'}
                {!submitting && <LuArrowRight size={16} />}
              </button>
            </form>

            <p className="text-center text-sm text-mut mt-6">
              Already have an account?{' '}
              <Link to="/login" className="font-bold text-teal hover:underline">
                Sign in
              </Link>
            </p>
          </div>

          <p className="text-center text-xs text-mut mt-4">
            In an emergency, call{' '}
            <a href="tel:999" className="font-bold text-ink">999</a> or{' '}
            <a href="tel:112" className="font-bold text-ink">112</a>.
          </p>
        </div>
      </div>
    </div>
  );
}