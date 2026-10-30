import { THEMES, THEME_MARK } from '../../data/themes';
import { useApp } from '../../context/app-context';
import { usePopover } from './usePopover';

/** Colour-theme picker (kept from the shared theme system). Lives in the menu/footer to keep the navbar uncluttered. */
export default function ThemeSelector({ direction = 'down' }) {
  const { theme, setTheme } = useApp();
  const { open, setOpen, close, rootRef, triggerRef } = usePopover();

  return (
    <div className="relative inline-block" ref={rootRef}>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Colour theme: ${theme}`}
        className="tk-nav-btn gap-2 border border-white/20"
      >
        <span className="w-4 h-4 rounded-full border border-white/40" style={{ backgroundColor: THEME_MARK[theme] }} />
        <span className="capitalize">{theme}</span>
      </button>
      {open && (
        <div
          role="menu"
          aria-label="Colour theme"
          className={`tk-popover w-60 ${direction === 'up' ? 'bottom-full mb-2 left-0' : 'right-0'}`}
        >
          {THEMES.map((t) => (
            <button
              key={t.id}
              type="button"
              role="menuitemradio"
              aria-checked={theme === t.id}
              onClick={() => { setTheme(t.id); close(); triggerRef.current?.focus(); }}
              className="tk-popover-item"
            >
              <span className="w-5 h-5 rounded-full border border-white/30 shrink-0" style={{ backgroundColor: THEME_MARK[t.id] }} />
              <span className="flex-1 text-left">
                <span className="block font-semibold">{t.label}</span>
                <span className="block text-xs opacity-70">{t.desc}</span>
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
