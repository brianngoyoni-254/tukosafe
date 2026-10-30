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
      <Navbar />

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
