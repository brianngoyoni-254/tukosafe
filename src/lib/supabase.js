import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const isBackendConfigured = Boolean(url && anonKey);

const REMEMBER_KEY = 'tukosafe.remember';

// "Remember me" decides where the Supabase session lives:
//   checked   -> localStorage   (survives closing the browser)
//   unchecked -> sessionStorage (cleared when the browser session ends)
// Only the flag itself is kept in localStorage; it contains no secret.
export function setRemember(remember) {
  try {
    localStorage.setItem(REMEMBER_KEY, remember ? '1' : '0');
  } catch { /* storage blocked */ }
}

export function getRemember() {
  try {
    return localStorage.getItem(REMEMBER_KEY) !== '0';
  } catch {
    return false;
  }
}

const sessionAwareStorage = {
  getItem(key) {
    return sessionStorage.getItem(key) ?? localStorage.getItem(key);
  },
  setItem(key, value) {
    const [keep, drop] = getRemember() ? [localStorage, sessionStorage] : [sessionStorage, localStorage];
    drop.removeItem(key);
    keep.setItem(key, value);
  },
  removeItem(key) {
    sessionStorage.removeItem(key);
    localStorage.removeItem(key);
  },
};

// Never throws at import time; the UI shows a setup notice when unconfigured.
export const supabase = isBackendConfigured
  ? createClient(url, anonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        storage: sessionAwareStorage,
        storageKey: 'tukosafe.auth',
      },
      realtime: { params: { eventsPerSecond: 10 } },
    })
  : null;

/** Unwrap a Supabase response, turning `{ error }` into a thrown Error with a readable message. */
export function unwrap({ data, error }) {
  if (error) {
    const err = new Error(error.message || 'Something went wrong.');
    err.code = error.code;
    throw err;
  }
  return data;
}
