import { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { supabase, isBackendConfigured, setRemember, getRemember } from '../lib/supabase';

const AuthContext = createContext(null);

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const NOT_CONFIGURED = 'The backend is not configured. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY (see .env.example).';

function toUser(authUser, profile) {
  if (!authUser) return null;
  const name = profile?.display_name || authUser.user_metadata?.display_name || authUser.email?.split('@')[0] || 'You';
  return {
    id: authUser.id,
    name,
    email: authUser.email,
    phone: profile?.phone ?? authUser.user_metadata?.phone ?? '',
    avatar: name[0]?.toUpperCase() || 'U',
    emailConfirmed: Boolean(authUser.email_confirmed_at),
  };
}

function friendlyAuthError(err) {
  const msg = err?.message || 'Something went wrong. Please try again.';
  if (/invalid login credentials/i.test(msg)) return 'Incorrect email or password.';
  if (/email not confirmed/i.test(msg)) return 'Please verify your email first. Check your inbox for the confirmation link.';
  if (/already registered|already been registered/i.test(msg)) return 'An account with this email already exists.';
  if (/rate limit|too many/i.test(msg)) return 'Too many attempts. Please wait a minute and try again.';
  if (/failed to fetch|network/i.test(msg)) return 'Network problem. Check your connection and try again.';
  return msg;
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(isBackendConfigured);
  const [error, setError] = useState('');
  const [recovery, setRecovery] = useState(false);

  const loadProfile = useCallback(async (authUser) => {
    if (!authUser) return null;
    const { data } = await supabase
      .from('profiles').select('display_name, phone').eq('id', authUser.id).maybeSingle();
    return toUser(authUser, data);
  }, []);

  // Restore the persisted session and follow auth changes (refresh, sign-out in another tab, recovery link).
  useEffect(() => {
    if (!supabase) return undefined;
    let active = true;

    supabase.auth.getSession().then(async ({ data }) => {
      const u = await loadProfile(data.session?.user);
      if (active) { setUser(u); setLoading(false); }
    });

    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY') setRecovery(true);
      if (event === 'SIGNED_OUT') { setUser(null); return; }
      // Defer: never call Supabase from inside the callback synchronously (deadlock risk).
      setTimeout(async () => {
        const u = await loadProfile(session?.user);
        if (active) setUser(u);
      }, 0);
    });

    return () => { active = false; sub.subscription.unsubscribe(); };
  }, [loadProfile]);

  const clearError = useCallback(() => setError(''), []);

  const fail = useCallback((message) => { setError(message); return { ok: false, error: message }; }, []);

  const signup = useCallback(async ({ name, email, phone, password }) => {
    setError('');
    if (!supabase) return fail(NOT_CONFIGURED);
    const cleanEmail = email.trim().toLowerCase();
    const cleanName = name.trim();
    if (cleanName.length < 2) return fail('Please enter your full name.');
    if (!EMAIL_RE.test(cleanEmail)) return fail('Please enter a valid email address.');
    if (password.length < 8) return fail('Password must be at least 8 characters.');

    const { data, error: err } = await supabase.auth.signUp({
      email: cleanEmail,
      password,
      options: {
        data: { display_name: cleanName, phone: phone.trim() },
        emailRedirectTo: `${window.location.origin}/login`,
      },
    });
    if (err) return fail(friendlyAuthError(err));
    // With email confirmation on, Supabase returns a user but no session.
    // An obfuscated (already registered) response has an empty identities list.
    if (data.user && data.user.identities?.length === 0) return fail('An account with this email already exists.');
    return { ok: true, needsVerification: !data.session, email: cleanEmail };
  }, [fail]);

  const login = useCallback(async ({ email, password, remember = true }) => {
    setError('');
    if (!supabase) return fail(NOT_CONFIGURED);
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail || !password) return fail('Please enter your email and password.');
    // Choose the storage BEFORE signing in so the session lands in the right place.
    setRemember(remember);
    const { error: err } = await supabase.auth.signInWithPassword({ email: cleanEmail, password });
    if (err) return fail(friendlyAuthError(err));
    return { ok: true };
  }, [fail]);

  const logout = useCallback(async () => {
    setError('');
    setUser(null);
    if (supabase) await supabase.auth.signOut();
  }, []);

  const resendVerification = useCallback(async (email) => {
    if (!supabase) return fail(NOT_CONFIGURED);
    const { error: err } = await supabase.auth.resend({
      type: 'signup', email: email.trim().toLowerCase(),
      options: { emailRedirectTo: `${window.location.origin}/login` },
    });
    return err ? fail(friendlyAuthError(err)) : { ok: true };
  }, [fail]);

  const requestPasswordReset = useCallback(async (email) => {
    setError('');
    if (!supabase) return fail(NOT_CONFIGURED);
    const cleanEmail = email.trim().toLowerCase();
    if (!EMAIL_RE.test(cleanEmail)) return fail('Please enter a valid email address.');
    const { error: err } = await supabase.auth.resetPasswordForEmail(cleanEmail, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    return err ? fail(friendlyAuthError(err)) : { ok: true };
  }, [fail]);

  const setNewPassword = useCallback(async (password) => {
    if (!supabase) return fail(NOT_CONFIGURED);
    if (password.length < 8) return fail('Password must be at least 8 characters.');
    const { error: err } = await supabase.auth.updateUser({ password });
    if (err) return fail(friendlyAuthError(err));
    setRecovery(false);
    return { ok: true };
  }, [fail]);

  const changePassword = useCallback(async ({ current, next }) => {
    if (!supabase || !user) return { ok: false, error: 'Not signed in.' };
    if (next.length < 8) return { ok: false, error: 'New password must be at least 8 characters.' };
    // Re-authenticate with the current password first.
    const { error: reauth } = await supabase.auth.signInWithPassword({ email: user.email, password: current });
    if (reauth) return { ok: false, error: 'Current password is incorrect.' };
    const { error: err } = await supabase.auth.updateUser({ password: next });
    return err ? { ok: false, error: friendlyAuthError(err) } : { ok: true };
  }, [user]);

  const updateProfile = useCallback(async ({ name, phone }) => {
    if (!supabase || !user) return { ok: false, error: 'Not signed in.' };
    const cleanName = (name ?? user.name).trim();
    if (cleanName.length < 2) return { ok: false, error: 'Please enter your full name.' };
    const { error: err } = await supabase
      .from('profiles').update({ display_name: cleanName, phone: (phone ?? user.phone ?? '').trim() || null })
      .eq('id', user.id);
    if (err) return { ok: false, error: err.message };
    setUser((u) => ({ ...u, name: cleanName, phone: (phone ?? u.phone ?? '').trim(), avatar: cleanName[0].toUpperCase() }));
    return { ok: true };
  }, [user]);

  const deleteAccount = useCallback(async () => {
    if (!supabase) return { ok: false, error: NOT_CONFIGURED };
    const { error: err } = await supabase.rpc('delete_my_account');
    if (err) return { ok: false, error: err.message };
    await supabase.auth.signOut();
    setUser(null);
    return { ok: true };
  }, []);

  const value = useMemo(() => ({
    user,
    isAuthenticated: !!user,
    loading,
    error,
    recovery,
    configured: isBackendConfigured,
    rememberMe: getRemember(),
    clearError,
    signup,
    login,
    logout,
    resendVerification,
    requestPasswordReset,
    setNewPassword,
    changePassword,
    updateProfile,
    deleteAccount,
  }), [user, loading, error, recovery, clearError, signup, login, logout, resendVerification,
    requestPasswordReset, setNewPassword, changePassword, updateProfile, deleteAccount]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
