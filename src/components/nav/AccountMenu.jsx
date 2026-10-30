import { Link, useNavigate } from 'react-router-dom';
import { LuChevronDown, LuUser, LuSettings, LuLogOut, LuLogIn } from 'react-icons/lu';
import { useAuth } from '../../context/AuthContext';
import { usePopover } from './usePopover';

/** Signed-in account dropdown, or a Sign in link for visitors. */
export default function AccountMenu() {
  const { user, isAuthenticated, logout } = useAuth();
  const navigate = useNavigate();
  const { open, setOpen, close, rootRef, triggerRef } = usePopover();

  if (!isAuthenticated) {
    return (
      <Link to="/login" className="tk-nav-btn gap-1.5 no-underline">
        <LuLogIn size={16} aria-hidden="true" /> <span>Sign in</span>
      </Link>
    );
  }

  const initials = (user.name || 'U').split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase();
  const signOut = async () => { close(); await logout(); navigate('/'); };

  return (
    <div className="relative" ref={rootRef}>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Account menu for ${user.name}`}
        className="tk-nav-btn gap-2 pl-1.5"
      >
        <span className="w-7 h-7 rounded-full bg-amber text-[#1b1200] grid place-items-center font-bold text-xs">{initials}</span>
        <span className="max-w-[110px] truncate">{user.name}</span>
        <LuChevronDown size={14} aria-hidden="true" className={`transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div role="menu" className="absolute right-0 mt-2 w-60 rounded-xl bg-surface text-ink border border-line shadow-[0_18px_50px_rgba(7,20,30,0.35)] overflow-hidden z-50">
          <div className="px-4 py-3 border-b border-line">
            <p className="text-xs text-mut m-0">Signed in as</p>
            <p className="text-sm font-bold m-0 truncate">{user.email}</p>
          </div>
          <div className="p-1.5">
            <Link to="/profile" role="menuitem" onClick={close} className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-ink hover:bg-accentbg no-underline">
              <LuUser size={15} aria-hidden="true" /> Profile
            </Link>
            <Link to="/profile" role="menuitem" onClick={close} className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-ink hover:bg-accentbg no-underline">
              <LuSettings size={15} aria-hidden="true" /> Settings
            </Link>
            <button type="button" role="menuitem" onClick={signOut} className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-alert hover:bg-alertbg">
              <LuLogOut size={15} aria-hidden="true" /> Sign out
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
