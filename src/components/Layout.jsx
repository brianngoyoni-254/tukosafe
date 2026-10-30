import { Link, useLocation } from 'react-router-dom';
import { useEffect, useState } from 'react';
import {
  LuHouse, LuMap, LuUsers, LuMessageCircle, LuLifeBuoy,
  LuBookOpen, LuShieldCheck, LuInfo, LuPhone, LuCircleAlert,
  LuMenu, LuX,
} from 'react-icons/lu';
import { useApp } from '../context/app-context';
import { THEMES, THEME_MARK } from '../data/themes';
import Logo from './Logo';
import Toast from './Toast';

const PRIMARY_NAV = [
  { to: '/', label: 'Home', icon: LuHouse },
  { to: '/how', label: 'How it works', icon: LuBookOpen },
  { to: '/map', label: 'Live map', icon: LuMap },
  { to: '/outing', label: 'Outing', icon: LuUsers },
  { to: '/checkin', label: 'Check-in', icon: LuMessageCircle },
  { to: '/help', label: 'Get help', icon: LuLifeBuoy },
];

const SECONDARY_NAV = [
  { to: '/contacts', label: 'Contacts', icon: LuUsers },
  { to: '/contact', label: 'Contact view', icon: LuCircleAlert },
  { to: '/trust', label: 'Trust Panel', icon: LuShieldCheck },
  { to: '/safety', label: 'Safety', icon: LuShieldCheck },
  { to: '/about', label: 'About', icon: LuInfo },
];

function ThemeSelector({ theme, setTheme }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative inline-block">
      <button
        onClick={(e) => {
          e.stopPropagation();
          setOpen(!open);
        }}
        className="inline-flex items-center gap-2 h-9 px-3 rounded-lg border border-white/20 text-white text-sm font-semibold hover:bg-white/10 no-underline transition-colors"
        aria-label="Choose colour theme"
        aria-expanded={open}
      >
        <span className="shrink-0" style={{ width: 16, height: 16, borderRadius: '50%', backgroundColor: THEME_MARK[theme], border: '1px solid rgba(255,255,255,0.35)', display: 'inline-block' }} />
        <span className="hidden sm:inline">{theme.charAt(0).toUpperCase() + theme.slice(1)}</span>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" className="opacity-90 shrink-0"><polyline points="6 9 12 15 18 9" /></svg>
      </button>
      {open && (
        <div className="absolute right-0 mt-[-1px] w-48 rounded-xl border border-white/20 bg-white/10 p-1 shadow-2xl backdrop-blur-md" onMouseLeave={() => setOpen(false)}>
          {THEMES.map((t) => (
            <button key={t.id} onClick={() => { setTheme(t.id); setOpen(false); }} className={`flex items-center gap-3 w-full px-3 py-2 rounded-lg text-sm text-[#bfe0da] hover:bg-white/20 hover:text-white no-underline transition-colors ${theme === t.id ? 'bg-white/20 text-white font-semibold' : ''}`}>
              <span className="w-6 h-6 rounded-full border border-white/30 shrink-0" style={{ backgroundColor: THEME_MARK[t.id] }} />
              <span>{t.label}</span>
              <span className="ml-auto text-xs opacity-70">{t.desc}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default function Layout({ children }) {
  const { pathname } = useLocation();
  const { theme, setTheme } = useApp();
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => { window.scrollTo(0, 0); }, [pathname]);
  useEffect(() => {
    document.body.style.overflow = mobileOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [mobileOpen]);

  return (
    <div className="min-h-screen flex flex-col bg-surface text-ink font-body">
      {/* ============ HEADER ============ */}
      <header className="sticky top-0 z-40 bg-deep/95 backdrop-blur-md border-b border-white/10">
        <div className="max-w-[1240px] mx-auto px-4 sm:px-6 lg:px-8">
          <div className="h-16 flex items-center justify-between gap-6">

            {/* Brand */}
            <Link
              to="/"
              className="flex items-center gap-2.5 shrink-0 text-white no-underline group"
              aria-label="TukoSafe home"
            >
              <Logo className="shrink-0" />
            </Link>

            {/* Desktop nav */}
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

            {/* Right actions (desktop) */}
            <div className="hidden lg:flex items-center gap-2.5">
              <ThemeSelector theme={theme} setTheme={setTheme} />
              <Link to="/about" className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg text-sm font-semibold text-[#bfe0da] hover:text-white hover:bg-white/5 no-underline transition-colors">About</Link>
              <Link to="/help" className="inline-flex items-center gap-1.5 h-9 px-4 rounded-lg bg-amber text-[#1b1200] font-bold text-sm no-underline hover:brightness-105 transition"><LuHouse size={14} /> Get Me Home</Link>
            </div>

            {/* Mobile menu button */}
            <button onClick={() => setMobileOpen((o) => !o)} className="lg:hidden w-10 h-10 grid place-items-center rounded-lg bg-white/10 text-white hover:bg-white/15 transition" aria-expanded={mobileOpen} aria-label="Open menu">{mobileOpen ? <LuX size={20} /> : <LuMenu size={20} />}</button>
          </div>
        </div>

        {/* Mobile menu overlay */}
        {mobileOpen && (
          <>
            <div className="fixed inset-0 z-40 bg-black/40 lg:hidden" onClick={() => setMobileOpen(false)} aria-hidden="true" />
            <nav className="fixed top-16 right-0 bottom-0 z-50 w-[300px] max-w-[85vw] bg-deep text-white lg:hidden overflow-y-auto border-l border-white/10 shadow-2xl">
              <div className="p-4">
                <div className="flex items-center gap-2.5 mb-8"><Logo className="shrink-0" /></div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-[#8fb9b2] mb-6 px-2">Main</p>
                <ul className="space-y-1 p-0 m-0 list-none">
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
            </nav>
          </>
        )}
      </header>

      <main className="flex-1">{children}</main>

      {/* ============ FOOTER ============ */}
      <footer className="bg-deep text-[#bfe0da] mt-10">
        <div className="max-w-[1240px] mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="grid gap-8 md:grid-cols-[2fr_1fr_1fr]">
            <div>
              <Link to="/" className="inline-flex items-center gap-2.5 text-white no-underline mb-3"><Logo className="shrink-0" /></Link>
              <p className="text-sm max-w-[40ch] m-0">From the Swahili <i>tuko salama</i>, “we are safe”. Go out. Have fun. Get home safe.</p>
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-[#8fb9b2] mb-3">Product</p>
              <ul className="space-y-2 text-sm list-none p-0 m-0">
                <li><Link to="/how" className="text-[#bfe0da] hover:text-white no-underline">How it works</Link></li>
                <li><Link to="/map" className="text-[#bfe0da] hover:text-white no-underline">Live map</Link></li>
                <li><Link to="/trust" className="text-[#bfe0da] hover:text-white no-underline">Trust Panel</Link></li>
                <li><Link to="/safety" className="text-[#bfe0da] hover:text-white no-underline">Safety resources</Link></li>
              </ul>
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-[#8fb9b2] mb-3">Emergency</p>
              <ul className="space-y-2 text-sm list-none p-0 m-0">
                <li><a href="tel:999" className="text-[#bfe0da] hover:text-white no-underline">Call 999</a></li>
                <li><a href="tel:112" className="text-[#bfe0da] hover:text-white no-underline">Call 112</a></li>
                <li><a href="tel:1195" className="text-[#bfe0da] hover:text-white no-underline">1195 · Gender violence</a></li>
                <li><a href="tel:116" className="text-[#bfe0da] hover:text-white no-underline">116 · Child helpline</a></li>
              </ul>
            </div>
          </div>
          <div className="mt-8 pt-6 border-t border-white/10 text-xs opacity-80">
            <p className="m-0">Prototype only: AI examples, contacts, messages, location sharing and transport are simulated or local previews. Nothing is sent to friends or responders. TukoSafe is not an emergency service; call 999 or 112 if you need emergency help.</p>
          </div>
        </div>
      </footer>

      {/* Mobile dock */}
      <div className="lg:hidden fixed bottom-0 left-0 right-0 z-30 grid grid-cols-3 gap-2 bg-deep border-t border-white/10 px-3 py-2.5 pb-[calc(10px+env(safe-area-inset-bottom,0px))]">
        <Link to="/help" className="inline-flex items-center justify-center gap-1.5 min-h-12 px-2 rounded-xl bg-amber text-[#1b1200] font-bold text-sm no-underline"><LuHouse size={16} /> Get Me Home</Link>
        <Link to="/help" className="inline-flex items-center justify-center gap-1.5 min-h-12 px-2 rounded-xl bg-red text-white font-bold text-sm no-underline"><LuCircleAlert size={16} /> SOS</Link>
        <a href="tel:999" className="inline-flex items-center justify-center gap-1.5 min-h-12 px-2 rounded-xl border-2 border-white/30 text-white font-bold text-sm no-underline"><LuPhone size={16} /> Call 999</a>
      </div>
      <div className="lg:hidden h-16" />

      <Toast />
    </div>
  );
}
