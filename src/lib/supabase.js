import { createClient } from '@supabase/supabase-js';
import { evaluateConfig, pickKey } from './supabaseConfig';

// Public key: the new "publishable" key or the legacy "anon" key (publishable wins if both are set).
const config = evaluateConfig({
  url: import.meta.env.VITE_SUPABASE_URL,
  key: pickKey(import.meta.env).value,
});
const url = config.url;
const anonKey = config.key;

export const isBackendConfigured = config.ok;
/** Human-readable reason the backend is unusable (empty string when configured). */
export const configProblem = config.problem;

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

// Never throws at import time; the UI shows a setup notice when unconfigured or when the key is unsafe.
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
