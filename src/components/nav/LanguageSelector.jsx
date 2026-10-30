import { LuGlobe, LuCheck } from 'react-icons/lu';
import { useApp } from '../../context/app-context';
import { LANG_LABELS } from '../../data/dummy';
import { usePopover } from './usePopover';

const CODES = { en: 'EN', sw: 'SW', sh: 'SH' };

/** Compact language dropdown for the desktop navbar. */
export function LanguageSelector() {
  const { lang, setLang } = useApp();
  const { open, setOpen, close, rootRef, triggerRef } = usePopover();

  return (
    <div className="relative" ref={rootRef}>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Language: ${LANG_LABELS[lang]}`}
        className="tk-nav-btn gap-1.5"
      >
        <LuGlobe size={16} aria-hidden="true" />
        <span>{CODES[lang]}</span>
      </button>
      {open && (
        <div role="menu" aria-label="Language" className="tk-popover right-0 w-44">
          {Object.entries(LANG_LABELS).map(([code, label]) => (
            <button
              key={code}
              type="button"
              role="menuitemradio"
              aria-checked={lang === code}
              onClick={() => { setLang(code); close(); triggerRef.current?.focus(); }}
              className="tk-popover-item"
            >
              <span>{label}</span>
              {lang === code && <LuCheck size={15} aria-hidden="true" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/** Segmented language control for the mobile menu. */
export function LanguageSegmented() {
  const { lang, setLang } = useApp();
  return (
    <div role="radiogroup" aria-label="Language" className="grid grid-cols-3 gap-1 p-1 rounded-xl bg-white/5 border border-white/10">
      {Object.entries(LANG_LABELS).map(([code, label]) => (
        <button
          key={code}
          type="button"
          role="radio"
          aria-checked={lang === code}
          onClick={() => setLang(code)}
          className={`h-10 rounded-lg text-sm font-semibold transition ${lang === code ? 'bg-white/15 text-white' : 'text-white/75 hover:bg-white/10'}`}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
