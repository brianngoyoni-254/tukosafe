import { useEffect, useRef } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { LuHouse, LuPhone, LuLogIn, LuLogOut, LuUser, LuChevronRight } from 'react-icons/lu';
import { useAuth } from '../context/AuthContext';
import { PRIMARY_NAV, SECONDARY_NAV } from './nav/navItems';
import { LanguageSegmented } from './nav/LanguageSelector';
import ThemeSelector from './nav/ThemeSelector';

const FOCUSABLE = 'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])';

function NavList({ items, pathname, onNavigate }) {
  return (
    <ul className="list-none p-0 m-0 grid gap-0.5">
      {items.map(({ to, label, icon: Icon }) => {
        const active = pathname === to;
        return (
          <li key={to}>
            <Link
              to={to}
              onClick={onNavigate}
              aria-current={active ? 'page' : undefined}
              className={`flex items-center justify-between gap-3 min-h-11 px-3 rounded-xl text-[0.95rem] no-underline transition ${
                active ? 'bg-white/12 text-white font-semibold shadow-[inset_3px_0_0_var(--color-amber)]' : 'text-white/80 hover:bg-white/8 hover:text-white'
              }`}
            >
              <span className="flex items-center gap-3"><Icon size={18} aria-hidden="true" className="opacity-90" />{label}</span>
              <LuChevronRight size={15} aria-hidden="true" className="opacity-40" />
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

/** Drop-down menu for screens narrower than the navbar breakpoint. */
export default function MobileNavigation({ open, onClose, toggleRef }) {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { user, isAuthenticated, logout } = useAuth();
  const panelRef = useRef(null);
  const lastPath = useRef(pathname);

  // Close after navigation.
  useEffect(() => {
    if (lastPath.current !== pathname) { lastPath.current = pathname; if (open) onClose(); }
  }, [pathname, open, onClose]);

  // Scroll lock, focus into the panel on open, Escape to close, Tab kept inside menu + toggle.
  useEffect(() => {
    if (!open) return undefined;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const toggle = toggleRef.current;
    panelRef.current?.querySelector(FOCUSABLE)?.focus();

    const onKey = (e) => {
      if (e.key === 'Escape') { e.preventDefault(); onClose(); toggle?.focus(); return; }
      if (e.key !== 'Tab') return;
      const items = [toggle, ...panelRef.current.querySelectorAll(FOCUSABLE)].filter(Boolean);
      const first = items[0]; const last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = prevOverflow; };
  }, [open, onClose, toggleRef]);

  if (!open) return null;

  const signOut = async () => { onClose(); await logout(); navigate('/'); };
  const initials = user ? (user.name || 'U').split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase() : '';

  return (
    <div className="fixed inset-x-0 top-[72px] bottom-0 z-30 min-[1240px]:hidden">
      <div className="absolute inset-0 bg-black/55" onClick={onClose} aria-hidden="true" />
      <div
        id="mobile-menu"
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label="Menu"
        className="tk-drawer relative max-h-full overflow-y-auto overscroll-contain bg-deep text-white border-b border-white/10 shadow-2xl"
      >
        <div className="mx-auto max-w-[640px] p-4 grid gap-5">
          {isAuthenticated ? (
            <div className="flex items-center gap-3 p-3 rounded-xl bg-white/6 border border-white/10">
              <span className="w-10 h-10 rounded-full bg-amber text-[#1b1200] grid place-items-center font-bold text-sm">{initials}</span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold m-0 truncate">{user.name}</p>
                <p className="text-xs text-white/65 m-0 truncate">{user.email}</p>
              </div>
              <Link to="/profile" aria-label="Profile and settings" className="w-10 h-10 grid place-items-center rounded-lg hover:bg-white/10 text-white"><LuUser size={18} aria-hidden="true" /></Link>
            </div>
          ) : (
            <Link to="/login" className="flex items-center justify-center gap-2 h-11 rounded-xl border border-white/25 text-white font-bold text-sm no-underline hover:bg-white/8">
              <LuLogIn size={16} aria-hidden="true" /> Sign in
            </Link>
          )}

          <nav aria-label="Main">
            <p className="text-[11px] font-bold uppercase tracking-wider text-white/55 mb-2 px-2 m-0">Navigation</p>
            <NavList items={PRIMARY_NAV} pathname={pathname} onNavigate={onClose} />
          </nav>
          <nav aria-label="More">
            <p className="text-[11px] font-bold uppercase tracking-wider text-white/55 mb-2 px-2 m-0">More</p>
            <NavList items={SECONDARY_NAV} pathname={pathname} onNavigate={onClose} />
          </nav>

          <div className="grid gap-3">
            <p className="text-[11px] font-bold uppercase tracking-wider text-white/55 px-2 m-0">Language</p>
            <LanguageSegmented />
            <div className="flex items-center justify-between gap-3 px-2">
              <span className="text-sm text-white/75">Colour theme</span>
              <ThemeSelector direction="up" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2.5">
            <Link to="/help" className="tk-cta"><LuHouse size={16} aria-hidden="true" /> Get Me Home</Link>
            <a href="tel:999" className="inline-flex items-center justify-center gap-2 h-[42px] rounded-xl border border-white/25 text-white font-bold text-sm no-underline hover:bg-white/8">
              <LuPhone size={16} aria-hidden="true" /> Call 999
            </a>
          </div>

          {isAuthenticated && (
            <button type="button" onClick={signOut} className="flex items-center justify-center gap-2 h-11 rounded-xl text-white/85 hover:bg-white/8 text-sm font-semibold">
              <LuLogOut size={16} aria-hidden="true" /> Sign out
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
