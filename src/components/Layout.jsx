import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useEffect } from 'react';
import { LuHouse, LuPhone, LuCircleAlert } from 'react-icons/lu';
import { useAuth } from '../context/AuthContext';
import Logo from './Logo';
import Toast from './Toast';
import Navbar from './Navbar';
import ThemeSelector from './nav/ThemeSelector';

const FOOTER_LINK = 'text-[#bfe0da] hover:text-white no-underline';

export default function Layout({ children }) {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { isAuthenticated, logout } = useAuth();

  useEffect(() => { window.scrollTo(0, 0); }, [pathname]);

  const handleLogout = async () => {
    await logout();
    navigate('/');
  };

  return (
    <div className="min-h-screen flex flex-col bg-surface text-ink font-body">
      {/* ============ HEADER ============ */}
      <header className="sticky top-0 z-40 bg-deep/95 backdrop-blur-md border-b border-white/10">
        <div className="max-w-[1240px] mx-auto px-4 sm:px-6 lg:px-8">
          <div className="h-16 flex items-center justify-between gap-4">

            {/* LEFT: mobile hamburger + brand */}
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => setMobileOpen((v) => !v)}
                aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
                aria-expanded={mobileOpen}
                className="lg:hidden w-10 h-10 -ml-2 grid place-items-center rounded-lg text-white hover:bg-white/10 transition"
              >
                {mobileOpen ? <LuX size={22} /> : <LuMenu size={22} />}
              </button>

              <Link
                to="/"
                className="flex items-center gap-2.5 text-white no-underline group"
                aria-label="TukoSafe home"
              >
                <span className="w-8 h-8 rounded-[50%_50%_50%_4px] bg-amber -rotate-45 inline-block transition-transform group-hover:rotate-[-30deg]" />
                <span className="font-display font-extrabold text-xl tracking-tight">TukoSafe</span>
              </Link>
            </div>

            {/* CENTER: desktop nav */}
            <nav className="hidden lg:flex items-center gap-1 flex-1 justify-center" aria-label="Main">
              {PRIMARY_NAV.map(({ to, label, icon: Icon }) => {
                const active = pathname === to;
                return (
                  <Link
                    key={to}
                    to={to}
                    aria-current={active ? 'page' : undefined}
                    className={`relative inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-sm font-medium no-underline transition-colors ${
                      active
                        ? 'text-white bg-white/10'
                        : 'text-[#bfe0da] hover:text-white hover:bg-white/5'
                    }`}
                  >
                    <Icon size={15} className="opacity-90" />
                    {label}
                    {active && (
                      <span className="absolute left-3.5 right-3.5 -bottom-[17px] h-[2px] bg-accent rounded-full" />
                    )}
                  </Link>
                );
              })}
            </nav>

            {/* RIGHT: emergency + auth */}
            <div className="hidden lg:flex items-center gap-2.5 shrink-0">
              <a
                href="tel:999"
                className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg text-sm font-semibold text-[#bfe0da] hover:text-white hover:bg-white/5 no-underline transition-colors"
                aria-label="Call 999"
              >
                <LuPhone size={14} />
                999
              </a>

              <ThemeSelector theme={theme} setTheme={setTheme} />

              {isAuthenticated && <NotificationBell />}

              {isAuthenticated ? (
                <div className="relative" data-user-menu>
                  <button
                    type="button"
                    onClick={() => setUserMenuOpen((v) => !v)}
                    aria-expanded={userMenuOpen}
                    aria-haspopup="menu"
                    className="inline-flex items-center gap-2 h-9 pl-1.5 pr-3 rounded-lg text-sm font-semibold text-white hover:bg-white/10 transition-colors"
                  >
                    <span className="w-7 h-7 rounded-full bg-amber text-[#1b1200] grid place-items-center font-bold text-xs">
                      {initials}
                    </span>
                    <span className="max-w-[120px] truncate">{user.name}</span>
                    <LuChevronDown size={14} className={`transition-transform ${userMenuOpen ? 'rotate-180' : ''}`} />
                  </button>

                  {userMenuOpen && (
                    <div
                      role="menu"
                      className="absolute right-0 mt-2 w-56 rounded-xl bg-white border border-line shadow-[0_18px_50px_rgba(7,39,36,0.15)] overflow-hidden animate-[fadeIn_.15s_ease-out]"
                    >
                      <div className="px-4 py-3 border-b border-line bg-[#fafcfb]">
                        <p className="text-xs text-mut m-0">Signed in as</p>
                        <p className="text-sm font-bold m-0 truncate">{user.email}</p>
                      </div>
                      <div className="p-1.5">
                        <Link
                          to="/profile"
                          role="menuitem"
                          className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-ink hover:bg-mint no-underline"
                        >
                          <LuUser size={15} /> Profile
                        </Link>
                        <Link
                          to="/profile"
                          role="menuitem"
                          className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-ink hover:bg-mint no-underline"
                        >
                          <LuSettings size={15} /> Settings
                        </Link>
                        <button
                          type="button"
                          onClick={handleLogout}
                          role="menuitem"
                          className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-red hover:bg-redbg transition-colors"
                        >
                          <LuLogOut size={15} /> Sign out
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <>
                  <Link
                    to="/login"
                    className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg text-sm font-semibold text-[#bfe0da] hover:text-white hover:bg-white/5 no-underline transition-colors"
                  >
                    <LuLogIn size={14} /> Sign in
                  </Link>
                  <Link
                    to="/help"
                    className="inline-flex items-center gap-1.5 h-9 px-4 rounded-lg bg-amber text-[#1b1200] font-bold text-sm no-underline hover:brightness-105 transition"
                  >
                    <LuHouse size={15} />
                    Get Me Home
                  </Link>
                </>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* ============ MOBILE DRAWER (slides from LEFT) ============ */}
      {mobileOpen && (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/50 lg:hidden"
            onClick={() => setMobileOpen(false)}
            aria-hidden="true"
          />
          <aside
            className="fixed top-16 left-0 bottom-0 z-50 w-[300px] max-w-[85vw] bg-deep text-white lg:hidden overflow-y-auto border-r border-white/10 shadow-2xl animate-[slideIn_.2s_ease-out]"
            role="dialog"
            aria-label="Menu"
          >
            <div className="p-4 space-y-6">
              {/* User card (mobile) */}
              {isAuthenticated ? (
                <div className="flex items-center gap-3 p-3 rounded-xl bg-white/5 border border-white/10">
                  <span className="w-10 h-10 rounded-full bg-amber text-[#1b1200] grid place-items-center font-bold text-sm">
                    {initials}
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm font-bold m-0 truncate">{user.name}</p>
                    <p className="text-xs text-[#8fb9b2] m-0 truncate">{user.email}</p>
                  </div>
                </div>
              ) : (
                <Link
                  to="/login"
                  className="flex items-center justify-center gap-2 h-11 rounded-lg bg-amber text-[#1b1200] font-bold text-sm no-underline"
                >
                  <LuLogIn size={16} /> Sign in
                </Link>
              )}

              {/* Primary */}
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-[#8fb9b2] mb-2 px-2">
                  Navigation
                </p>
                <ul className="space-y-0.5 p-0 m-0 list-none">
                  {PRIMARY_NAV.map(({ to, label, icon: Icon }) => {
                    const active = pathname === to;
                    return (
                      <li key={to}>
                        <Link to={to} onClick={() => setMobileOpen(false)} className={`flex items-center justify-between gap-2 px-3 py-2.5 rounded-lg text-sm no-underline transition ${active ? 'bg-white/10 text-white font-semibold' : 'text-[#bfe0da] hover:bg-white/5 hover:text-white'}`}>
                          <div className="flex items-center gap-2.5"><Icon size={16} className="opacity-90" />{label}</div>
                          {active && <span className="w-1.5 h-1.5 bg-accent rounded-full" />}
                        </Link>
                      </li>
                    );
                  })}
                </ul>
                <p className="text-[10px] font-bold uppercase tracking-wider text-[#8fb9b2] mb-6 px-2 mt-8">More</p>
                <ul className="space-y-1 p-0 m-0 list-none">
                  {SECONDARY_NAV.map(({ to, label, icon: Icon }) => (
                    <li key={to}>
                      <Link to={to} onClick={() => setMobileOpen(false)} className={`flex items-center justify-between gap-2 px-3 py-2.5 rounded-lg text-sm no-underline transition ${pathname === to ? 'bg-white/10 text-white font-semibold' : 'text-[#bfe0da] hover:bg-white/5 hover:text-white'}`}>
                        <div className="flex items-center gap-2.5"><Icon size={16} className="opacity-90" />{label}</div>
                        {pathname === to && <span className="w-1.5 h-1.5 bg-accent rounded-full" />}
                      </Link>
                    </li>
                  ))}
                </ul>
                <div className="pt-6 border-t border-white/10 space-y-2">
                  <ThemeSelector theme={theme} setTheme={setTheme} />
                  <Link to="/help" className="w-full inline-flex items-center justify-center gap-2 h-11 rounded-lg bg-amber text-[#1b1200] font-bold text-sm no-underline"><LuHouse size={15} /> Get Me Home</Link>
                  <Link to="/help" className="w-full inline-flex items-center justify-center gap-2 h-11 rounded-lg border-2 border-white/20 text-white font-bold text-sm no-underline"><LuCircleAlert size={15} /> SOS</Link>
                </div>
              </div>

              {/* Sign out (mobile) */}
              {isAuthenticated && (
                <div className="pt-2 border-t border-white/10">
                  <button
                    type="button"
                    onClick={handleLogout}
                    className="w-full flex items-center justify-center gap-2 h-11 rounded-lg border-2 border-white/20 text-white font-bold text-sm hover:bg-white/5 transition"
                  >
                    <LuLogOut size={16} /> Sign out
                  </button>
                </div>
              )}

              {/* Emergency CTA */}
              <div className="pt-2 border-t border-white/10 space-y-2">
                <Link
                  to="/help"
                  className="w-full inline-flex items-center justify-center gap-2 h-11 rounded-lg bg-amber text-[#1b1200] font-bold text-sm no-underline"
                >
                  <LuHouse size={16} /> Get Me Home
                </Link>
                <a
                  href="tel:999"
                  className="w-full inline-flex items-center justify-center gap-2 h-11 rounded-lg border-2 border-white/20 text-white font-bold text-sm no-underline"
                >
                  <LuPhone size={16} /> Call 999
                </a>
              </div>
            </div>
          </aside>
        </>
      )}

      <main className="flex-1">{children}</main>

      {/* ============ FOOTER ============ */}
      <footer className="bg-deep text-[#bfe0da] mt-10">
        <div className="max-w-[1240px] mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="grid gap-8 md:grid-cols-[2fr_1fr_1fr_1fr]">
            <div>
              <Link to="/" className="inline-flex items-center gap-2.5 text-white no-underline mb-3"><Logo className="shrink-0" /></Link>
              <p className="text-sm max-w-[40ch] m-0">From the Swahili <i>tuko salama</i>, “we are safe”. Go out. Have fun. Get home safe.</p>
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-[#8fb9b2] mb-3">Product</p>
              <ul className="space-y-2 text-sm list-none p-0 m-0">
                <li><Link to="/how" className={FOOTER_LINK}>How it works</Link></li>
                <li><Link to="/map" className={FOOTER_LINK}>Live map</Link></li>
                <li><Link to="/trust" className={FOOTER_LINK}>Trust Panel</Link></li>
                <li><Link to="/safety" className={FOOTER_LINK}>Safety resources</Link></li>
              </ul>
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-[#8fb9b2] mb-3">Account</p>
              <ul className="space-y-2 text-sm list-none p-0 m-0">
                {isAuthenticated ? (
                  <>
                    <li><Link to="/profile" className={FOOTER_LINK}>Profile</Link></li>
                    <li>
                      <button type="button" onClick={handleLogout} className="text-[#bfe0da] hover:text-white bg-transparent border-0 p-0 cursor-pointer text-sm">
                        Sign out
                      </button>
                    </li>
                  </>
                ) : (
                  <>
                    <li><Link to="/login" className={FOOTER_LINK}>Sign in</Link></li>
                    <li><Link to="/signup" className={FOOTER_LINK}>Create account</Link></li>
                  </>
                )}
              </ul>
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-[#8fb9b2] mb-3">Emergency</p>
              <ul className="space-y-2 text-sm list-none p-0 m-0">
                <li><a href="tel:999" className={FOOTER_LINK}>Call 999</a></li>
                <li><a href="tel:112" className={FOOTER_LINK}>Call 112</a></li>
                <li><a href="tel:1195" className={FOOTER_LINK}>1195 · Gender violence</a></li>
                <li><a href="tel:116" className={FOOTER_LINK}>116 · Child helpline</a></li>
              </ul>
            </div>
          </div>
          <div className="mt-8 pt-6 border-t border-white/10 text-xs flex flex-wrap items-center justify-between gap-4">
            <p className="m-0 opacity-80 max-w-[70ch]">
              TukoSafe is not an emergency service. Notifying friends is not dispatching responders.
              Status indicators are not a guarantee of anyone&apos;s safety.
            </p>
            <ThemeSelector direction="up" />
          </div>
        </div>
      </footer>

      {/* Mobile dock (shown whenever the main navigation is collapsed) */}
      <div className="min-[1240px]:hidden fixed bottom-0 left-0 right-0 z-30 grid grid-cols-3 gap-2 bg-deep border-t border-white/10 px-3 py-2.5 pb-[calc(10px+env(safe-area-inset-bottom,0px))]">
        <Link to="/help" className="inline-flex items-center justify-center gap-1.5 min-h-12 px-2 rounded-xl bg-amber text-[#1b1200] font-bold text-sm no-underline"><LuHouse size={16} aria-hidden="true" /> Get Me Home</Link>
        <Link to="/help" className="inline-flex items-center justify-center gap-1.5 min-h-12 px-2 rounded-xl bg-red text-white font-bold text-sm no-underline"><LuCircleAlert size={16} aria-hidden="true" /> SOS</Link>
        <a href="tel:999" className="inline-flex items-center justify-center gap-1.5 min-h-12 px-2 rounded-xl border-2 border-white/30 text-white font-bold text-sm no-underline"><LuPhone size={16} aria-hidden="true" /> Call 999</a>
      </div>
      <div className="min-[1240px]:hidden h-16" />

      <Toast />
    </div>
  );
}
