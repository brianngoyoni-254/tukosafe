import { useEffect, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { LuHouse, LuMenu, LuX, LuPhone } from 'react-icons/lu';
import { PRIMARY_NAV } from './nav/navItems';
import { LanguageSelector } from './nav/LanguageSelector';
import AccountMenu from './nav/AccountMenu';
import MobileNavigation from './MobileNavigation';
import './nav/nav.css';

function BrandMark() {
  return (
    <svg width="30" height="30" viewBox="0 0 32 32" aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id="tk-pin" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#f2a23a" />
          <stop offset="1" stopColor="#b36b00" />
        </linearGradient>
      </defs>
      <path d="M16 2.5c-5.5 0-9.5 4.2-9.5 9.4 0 6.6 7.6 14.5 8.6 15.5.5.5 1.3.5 1.8 0 1-1 8.6-8.9 8.6-15.5 0-5.2-4-9.4-9.5-9.4z" fill="url(#tk-pin)" />
      <circle cx="16" cy="12" r="4.2" fill="var(--color-deep)" />
      <circle cx="16" cy="12" r="1.7" fill="#f5f8fa" />
    </svg>
  );
}

export default function Navbar() {
  const { pathname } = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const toggleRef = useRef(null);
  // The home page shows artwork behind a translucent navbar; every other page keeps the solid one.
  const overlay = pathname === '/';
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    if (!overlay) return undefined;
    // State only changes when the threshold is crossed, so scrolling does not re-render the navbar.
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [overlay]);

  // Closing on route change is handled where the route link is clicked and by MobileNavigation itself.
  return (
    <>
      <header className="tk-header" data-overlay={overlay} data-scrolled={overlay && scrolled}>
        <div className="mx-auto max-w-[1400px] px-4 sm:px-6 lg:px-8">
          <div className="tk-header-inner">
            {/* Left: brand */}
            <Link to="/" aria-label="TukoSafe home" className="flex items-center gap-2.5 text-white no-underline justify-self-start">
              <BrandMark />
              <span className="font-display font-extrabold text-[1.3rem] tracking-tight leading-none">TukoSafe</span>
            </Link>

            {/* Centre: main navigation (one line; collapses into the menu below 1240px) */}
            <nav aria-label="Main" className="hidden min-[1240px]:flex items-center justify-center gap-0.5">
              {PRIMARY_NAV.map(({ to, label, icon: Icon }) => (
                <Link key={to} to={to} aria-current={pathname === to ? 'page' : undefined} className="tk-nav-link">
                  <Icon size={16} aria-hidden="true" className="hidden min-[1440px]:block opacity-90" />
                  <span>{label}</span>
                </Link>
              ))}
            </nav>
            <span className="min-[1240px]:hidden" aria-hidden="true" />

            {/* Right: actions */}
            <div className="flex items-center gap-2 justify-self-end">
              <a href="tel:999" className="tk-emergency" aria-label="Call emergency number 999">
                <LuPhone size={14} aria-hidden="true" />
                <span>999</span>
              </a>
              <div className="hidden min-[1240px]:flex items-center gap-1">
                <LanguageSelector />
                <AccountMenu />
              </div>
              <Link to="/help" className="tk-cta hidden md:inline-flex ml-1">
                <LuHouse size={16} aria-hidden="true" /> Get Me Home
              </Link>
              <button
                ref={toggleRef}
                type="button"
                onClick={() => setMenuOpen((v) => !v)}
                aria-label={menuOpen ? 'Close menu' : 'Open menu'}
                aria-expanded={menuOpen}
                aria-controls="mobile-menu"
                className="min-[1240px]:hidden tk-nav-btn !px-0 w-10 justify-center"
              >
                {menuOpen ? <LuX size={22} aria-hidden="true" /> : <LuMenu size={22} aria-hidden="true" />}
              </button>
            </div>
          </div>
        </div>
      </header>
      <MobileNavigation open={menuOpen} onClose={() => setMenuOpen(false)} toggleRef={toggleRef} />
    </>
  );
}
