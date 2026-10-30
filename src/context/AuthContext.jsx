import { createContext, useContext, useState, useEffect, useCallback } from 'react';

const AuthContext = createContext(null);

const USERS_KEY = 'tukosafe.users';
const SESSION_KEY = 'tukosafe.session';

// Simple hash for demo purposes (NOT production-safe)
function hashPassword(password) {
  let hash = 0;
  for (let i = 0; i < password.length; i++) {
    const char = password.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return 'h_' + Math.abs(hash).toString(36) + '_' + password.length;
}

function loadUsers() {
  try {
    return JSON.parse(localStorage.getItem(USERS_KEY) || '[]');
  } catch {
    return [];
  }
}

function saveUsers(users) {
  localStorage.setItem(USERS_KEY, JSON.stringify(users));
}

function loadSession() {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const session = JSON.parse(raw);
    // Session expires after 7 days
    if (session.expiresAt && Date.now() > session.expiresAt) {
      localStorage.removeItem(SESSION_KEY);
      return null;
    }
    return session;
  } catch {
    return null;
  }
}

function saveSession(session) {
  if (session) {
    localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  } else {
    localStorage.removeItem(SESSION_KEY);
  }
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Restore session on mount
  useEffect(() => {
    const session = loadSession();
    if (session) {
      const users = loadUsers();
      const found = users.find((u) => u.id === session.userId);
      if (found) {
        setUser({ id: found.id, name: found.name, email: found.email, phone: found.phone, avatar: found.avatar });
      } else {
        saveSession(null);
      }
    }
    setLoading(false);
  }, []);

  const clearError = useCallback(() => setError(''), []);

  const signup = useCallback(({ name, email, phone, password }) => {
    setError('');
    const trimmedEmail = email.trim().toLowerCase();
    const trimmedName = name.trim();

    if (!trimmedName || trimmedName.length < 2) {
      setError('Please enter your full name.');
      return { ok: false };
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      setError('Please enter a valid email address.');
      return { ok: false };
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return { ok: false };
    }

    const users = loadUsers();
    if (users.some((u) => u.email === trimmedEmail)) {
      setError('An account with this email already exists.');
      return { ok: false };
    }

    const newUser = {
      id: `u_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
      name: trimmedName,
      email: trimmedEmail,
      phone: phone.trim(),
      passwordHash: hashPassword(password),
      avatar: trimmedName[0].toUpperCase(),
      createdAt: Date.now(),
    };

    saveUsers([...users, newUser]);

    const session = {
      userId: newUser.id,
      createdAt: Date.now(),
      expiresAt: Date.now() + 7 * 24 * 60 * 60 * 1000,
    };
    saveSession(session);

    setUser({ id: newUser.id, name: newUser.name, email: newUser.email, phone: newUser.phone, avatar: newUser.avatar });
    return { ok: true };
  }, []);

  const login = useCallback(({ email, password }) => {
    setError('');
    const trimmedEmail = email.trim().toLowerCase();

    if (!trimmedEmail || !password) {
      setError('Please enter your email and password.');
      return { ok: false };
    }

    const users = loadUsers();
    const found = users.find((u) => u.email === trimmedEmail);

    if (!found) {
      setError('No account found with this email.');
      return { ok: false };
    }

    if (found.passwordHash !== hashPassword(password)) {
      setError('Incorrect password. Please try again.');
      return { ok: false };
    }

    const session = {
      userId: found.id,
      createdAt: Date.now(),
      expiresAt: Date.now() + 7 * 24 * 60 * 60 * 1000,
    };
    saveSession(session);

    setUser({ id: found.id, name: found.name, email: found.email, phone: found.phone, avatar: found.avatar });
    return { ok: true };
  }, []);

  const logout = useCallback(() => {
    saveSession(null);
    setUser(null);
    setError('');
  }, []);

  const updateProfile = useCallback((updates) => {
    if (!user) return { ok: false };
    const users = loadUsers();
    const idx = users.findIndex((u) => u.id === user.id);
    if (idx === -1) return { ok: false };

    const updated = { ...users[idx], ...updates };
    if (updates.name) updated.avatar = updates.name[0].toUpperCase();
    users[idx] = updated;
    saveUsers(users);

    setUser({ id: updated.id, name: updated.name, email: updated.email, phone: updated.phone, avatar: updated.avatar });
    return { ok: true };
  }, [user]);

  const changePassword = useCallback(({ current, next }) => {
    if (!user) return { ok: false, error: 'Not signed in.' };
    const users = loadUsers();
    const idx = users.findIndex((u) => u.id === user.id);
    if (idx === -1) return { ok: false, error: 'Account not found.' };

    if (users[idx].passwordHash !== hashPassword(current)) {
      return { ok: false, error: 'Current password is incorrect.' };
    }
    if (next.length < 6) {
      return { ok: false, error: 'New password must be at least 6 characters.' };
    }

    users[idx].passwordHash = hashPassword(next);
    saveUsers(users);
    return { ok: true };
  }, [user]);

  const value = {
    user,
    isAuthenticated: !!user,
    loading,
    error,
    clearError,
    signup,
    login,
    logout,
    updateProfile,
    changePassword,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}