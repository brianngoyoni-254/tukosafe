import { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import {
  LuMail, LuLock, LuEye, LuEyeOff, LuArrowRight, LuArrowLeft,
  LuShieldCheck, LuHouse, LuCircleAlert,
} from 'react-icons/lu';
import { useAuth } from '../context/AuthContext';

export default function Login() {
  const { login, error, clearError } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = location.state?.from || '/';
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    const result = await login({ email, password, remember });
    setSubmitting(false);
    if (result.ok) navigate(from, { replace: true });
  };

  return (
    <div className="min-h-[calc(100vh-4rem)] grid lg:grid-cols-2">
      {/* ── Left: Brand panel ── */}
      <div className="hidden lg:flex relative overflow-hidden bg-deep text-white p-12 flex-col justify-between">
        {/* Back-home tab */}
        <div className="flex items-center justify-between">
          <Link
            to="/"
            className="inline-flex items-center gap-3 text-white no-underline group"
            aria-label="TukoSafe home"
          >
            <span className="w-9 h-9 rounded-[50%_50%_50%_4px] bg-amber -rotate-45 inline-block transition-transform group-hover:rotate-[-30deg]" />
            <span className="font-display font-extrabold text-2xl tracking-tight">TukoSafe</span>
          </Link>
          <Link
            to="/"
            className="inline-flex items-center gap-2 h-9 px-4 rounded-full border border-white/20 text-sm font-semibold text-[#bfe0da] hover:text-white hover:bg-white/10 no-underline transition"
          >
            <LuArrowLeft size={14} /> Back home
          </Link>
        </div>

        <div className="relative z-10">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border border-white/20 text-[#bfe0da] text-sm mb-6">
            <span className="w-2 h-2 rounded-full bg-amber animate-[blink_1.6s_infinite]" />
            Welcome back
          </div>
          <h1 className="font-display font-extrabold text-[clamp(2.2rem,4.5vw,3.6rem)] leading-[1.05] mb-5">
            Go out.<br />Have fun.<br />
            <span className="text-amber">Get home safe.</span>
          </h1>
          <p className="text-[#bfe0da] text-lg max-w-[42ch]">
            Sign in to pick up where you left off — your outings, contacts and check-ins are waiting.
          </p>
          <div className="mt-8 grid grid-cols-2 gap-3 max-w-[440px]">
            {[
              ['AI informs, never acts', LuShieldCheck],
              ['Works with AI off', LuHouse],
            ].map(([label, Icon]) => (
              <div key={label} className="flex items-center gap-2.5 p-3 rounded-xl bg-white/5 border border-white/10">
                <Icon size={18} className="text-amber shrink-0" />
                <span className="text-sm text-[#bfe0da]">{label}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="relative z-10 text-sm text-[#8fb9b2]">
          Not an emergency service. In an emergency call{' '}
          <a href="tel:999" className="text-white font-bold hover:underline">999</a> or{' '}
          <a href="tel:112" className="text-white font-bold hover:underline">112</a>.
        </div>

        {/* Decorative rings */}
        <div className="absolute -right-40 -bottom-40 w-[480px] h-[480px] rounded-full border border-teal2/20 animate-[pulse-ring_8s_ease-out_infinite]" />
        <div className="absolute -right-20 -bottom-20 w-[320px] h-[320px] rounded-full border border-teal2/15 animate-[pulse-ring_8s_ease-out_infinite_2s]" />
      </div>

      {/* ── Right: Form ── */}
      <div className="flex items-center justify-center p-5 sm:p-10 bg-[#f4f8f7] relative">
        {/* Mobile back-home tab */}
        <div className="lg:hidden absolute top-4 left-4 right-4 flex items-center justify-between">
          <Link
            to="/"
            className="inline-flex items-center gap-2 h-9 px-3 rounded-lg border border-line bg-white text-sm font-semibold text-ink hover:bg-mint no-underline transition shadow-sm"
          >
            <LuArrowLeft size={14} /> Home
          </Link>
          <Link to="/" className="inline-flex items-center gap-2 text-ink no-underline">
            <span className="w-7 h-7 rounded-[50%_50%_50%_4px] bg-amber -rotate-45 inline-block" />
            <span className="font-display font-extrabold text-lg">TukoSafe</span>
          </Link>
        </div>

        <div className="w-full max-w-[420px] mt-14 lg:mt-0">
          <div className="bg-white rounded-2xl p-6 sm:p-8 shadow-[0_18px_50px_rgba(7,39,36,0.1)] border border-line">
            <h2 className="font-display font-extrabold text-2xl mb-1">Sign in</h2>
            <p className="text-mut text-sm mb-6">Welcome back. Enter your details to continue.</p>

            {error && (
              <div className="mb-4 p-3 rounded-lg bg-redbg text-red text-sm font-medium border border-red/20 flex items-start gap-2" role="alert">
                <LuCircleAlert size={16} className="mt-0.5 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={submit} className="space-y-4">
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
                <div className="flex items-center justify-between mb-1.5">
                  <label htmlFor="password" className="block text-sm font-bold">Password</label>
                  <Link to="/forgot-password" className="text-xs font-bold text-teal hover:underline">Forgot password?</Link>
                </div>
                <div className="relative">
                  <LuLock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-mut pointer-events-none" />
                  <input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => { setPassword(e.target.value); clearError(); }}
                    placeholder="••••••••"
                    className="w-full pl-10 pr-10 py-2.5 rounded-lg border border-line bg-white text-ink font-body text-sm focus:outline-none focus:border-teal focus:ring-2 focus:ring-teal/20 transition"
                    required
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
              </div>

              <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={remember}
                  onChange={(e) => setRemember(e.target.checked)}
                  className="w-4 h-4 accent-teal"
                />
                Remember me on this device
              </label>

              <button
                type="submit"
                disabled={submitting}
                className="w-full inline-flex items-center justify-center gap-2 h-11 rounded-lg bg-teal text-white font-bold text-sm hover:brightness-110 disabled:opacity-60 transition"
              >
                {submitting ? 'Signing in…' : 'Sign in'}
                {!submitting && <LuArrowRight size={16} />}
              </button>
            </form>

            <p className="text-center text-sm text-mut mt-6">
              New to TukoSafe?{' '}
              <Link to="/signup" className="font-bold text-teal hover:underline">
                Create an account
              </Link>
            </p>
          </div>

          <p className="text-center text-xs text-mut mt-4">
            Unchecked, you are signed out when you close the browser.
            Checked, you stay signed in until you sign out or your session expires.
          </p>
        </div>
      </div>
    </div>
  );
}