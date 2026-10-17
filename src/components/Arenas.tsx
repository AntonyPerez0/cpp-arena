import { useEffect, useId, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import { ChevronDown } from "lucide-react";

/**
 * The Arena sites: C/C++ Arena, Java Arena, RustArena and Python Arena, each teaching a language
 * with its real compiler or interpreter. Every site links to the others from its header, its phone
 * menu and its footer.
 *
 * This file is the same in all four repositories (cpp-arena, Java-Arena, RustArena, pythonarena)
 * except for HERE, so a change to the list or to a mark goes into all four.
 */
export type ArenaId = "cpp" | "java" | "rust" | "python";

/** Which Arena this site is. */
const HERE: ArenaId = "cpp";

type Arena = { id: ArenaId; name: string; language: string; url: string };

export const ARENAS: Arena[] = [
  { id: "cpp", name: "C/C++ Arena", language: "C and C++", url: "https://cpparena.com/" },
  { id: "java", name: "Java Arena", language: "Java", url: "https://javaarena.com/" },
  { id: "rust", name: "RustArena", language: "Rust", url: "https://rustarena.app/" },
  { id: "python", name: "Python Arena", language: "Python", url: "https://pythonarena.org/" },
];

const OTHERS = ARENAS.filter((a) => a.id !== HERE);
const host = (a: Arena) => new URL(a.url).host;

/** An Arena's mark: the same drawing as that site's logo (its src/components/Brand.tsx). */
export function ArenaMark({ id, className = "arena-mark" }: { id: ArenaId; className?: string }) {
  const g = useId();
  return (
    <svg className={className} viewBox="0 0 32 32" aria-hidden="true" focusable="false">
      {id === "python" ? (
        <>
          <rect width="32" height="32" rx="8" fill="#3776AB" />
          <path d="M6.5 10.5 11.5 16l-5 5.5M12.5 10.5l5 5.5-5 5.5M18.5 10.5l5 5.5-5 5.5" fill="none" stroke="#FFD43B" strokeWidth="2.9" strokeLinecap="round" strokeLinejoin="round" />
        </>
      ) : id === "java" ? (
        <>
          <rect width="32" height="32" rx="8" fill="#E11D21" />
          <path d="M11.5 8.8H21.5M18.6 8.8V18.4c0 3-1.7 4.8-4.4 4.8-1.9 0-3.2-.9-3.9-2.5" fill="none" stroke="#fff" strokeWidth="3.6" strokeLinecap="round" strokeLinejoin="round" />
        </>
      ) : id === "cpp" ? (
        <>
          <defs>
            <linearGradient id={g} x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor="#5C6BC0" />
              <stop offset="0.55" stopColor="#3F75B8" />
              <stop offset="1" stopColor="#00599C" />
            </linearGradient>
          </defs>
          <rect width="32" height="32" rx="8" fill={`url(#${g})`} />
          <rect x="0.5" y="0.5" width="31" height="31" rx="7.5" fill="none" stroke="#fff" strokeOpacity="0.25" />
          <path d="M17.6 10.1a7.2 7.2 0 1 0 0 11.8" fill="none" stroke="#fff" strokeWidth="3.4" strokeLinecap="round" />
          <path d="M23.4 12.6v6.8M20 16h6.8" stroke="#fff" strokeWidth="3" strokeLinecap="round" />
        </>
      ) : (
        <>
          <defs>
            <linearGradient id={g} x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor="#F98A1F" />
              <stop offset="0.5" stopColor="#E5531A" />
              <stop offset="1" stopColor="#B7410E" />
            </linearGradient>
          </defs>
          <rect width="32" height="32" rx="8" fill={`url(#${g})`} />
          <rect x="0.5" y="0.5" width="31" height="31" rx="7.5" fill="none" stroke="#fff" strokeOpacity="0.22" />
          <path d="M5.2 15.4c-1.7-1.3-1.9-4-.4-5.6 1-1 2.4-1.2 3.6-.7l-1.3 2.3 2.4.4c.3 1.6-.4 3.2-1.8 3.9-.8.4-1.7.3-2.5-.3z" fill="#fff" />
          <path d="M26.8 15.4c1.7-1.3 1.9-4 .4-5.6-1-1-2.4-1.2-3.6-.7l1.3 2.3-2.4.4c-.3 1.6.4 3.2 1.8 3.9.8.4 1.7.3 2.5-.3z" fill="#fff" />
          <path d="M8.6 15.2l2.4 2.2M23.4 15.2l-2.4 2.2" stroke="#fff" strokeWidth="1.6" strokeLinecap="round" />
          <path d="M10.2 22.2l-2 2.6M12.6 23.2l-1.2 2.8M21.8 22.2l2 2.6M19.4 23.2l1.2 2.8" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" />
          <path
            d="M8.6 20.4c0-3.9 3.3-7 7.4-7s7.4 3.1 7.4 7c0 1.9-3.3 3.3-7.4 3.3s-7.4-1.4-7.4-3.3zM9.6 16.6l.4-2.2 1.6 1M11.4 14.6l.9-2.1 1.3 1.4M14 13.4l1-1.9 1 1.9M17 13.4l1.3-1.4.9 2.1M19.4 14.6l1.6-1 .4 2.2"
            fill="#fff"
            stroke="#fff"
            strokeWidth="1"
            strokeLinejoin="round"
          />
          <circle cx="13.3" cy="18.6" r="1.35" fill="#2b1206" />
          <circle cx="18.7" cy="18.6" r="1.35" fill="#2b1206" />
          <circle cx="13.7" cy="18.1" r="0.45" fill="#fff" />
          <circle cx="19.1" cy="18.1" r="0.45" fill="#fff" />
        </>
      )}
    </svg>
  );
}

const newTab = <span className="visually-hidden"> (opens in a new tab)</span>;

/** All the Arenas: this one marked, the others linked (in a new tab, like the site's other outside links). */
function ArenaList({ className, onPick }: { className: string; onPick?: () => void }) {
  return (
    <ul className={className}>
      {ARENAS.map((a) => (
        <li key={a.id}>
          {a.id === HERE ? (
            <div className="arena-item arena-here">
              <ArenaMark id={a.id} />
              <span className="arena-text">
                <span className="arena-name">{a.name}</span>
                <span className="arena-sub">You're here</span>
              </span>
            </div>
          ) : (
            <a className="arena-item" href={a.url} target="_blank" rel="noopener noreferrer" onClick={onPick}>
              <ArenaMark id={a.id} />
              <span className="arena-text">
                <span className="arena-name">{a.name}</span>
                <span className="arena-sub">
                  Learn {a.language} <span aria-hidden="true">·</span> {host(a)}
                </span>
              </span>
              {newTab}
            </a>
          )}
        </li>
      ))}
    </ul>
  );
}

/**
 * The header's button for the other Arenas: their marks, opening the list of all of them. onOpen runs
 * when the list opens, so the header can close its menu and the two never cover each other.
 */
export function ArenaSwitcher({ onOpen }: { onOpen?: () => void }) {
  const [open, setOpen] = useState(false);
  const { pathname } = useLocation();
  const box = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const panel = useId();
  useEffect(() => setOpen(false), [pathname]);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        button.current?.focus();
      }
    };
    const onDown = (e: PointerEvent) => {
      if (!box.current?.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onDown);
    return () => {
      window.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onDown);
    };
  }, [open]);
  return (
    <div
      className="arena-switch"
      ref={box}
      onBlur={(e) => {
        // Close once keyboard focus moves on past the list.
        if (open && !e.currentTarget.contains(e.relatedTarget as Node | null)) setOpen(false);
      }}
    >
      <button
        ref={button}
        type="button"
        className="arena-switch-btn"
        aria-expanded={open}
        aria-controls={panel}
        title="Other Arena sites"
        onClick={() => {
          if (!open) onOpen?.();
          setOpen(!open);
        }}
      >
        <span className="arena-switch-marks" aria-hidden="true">
          {OTHERS.map((a) => (
            <ArenaMark key={a.id} id={a.id} />
          ))}
        </span>
        <span className="visually-hidden">Other Arena sites</span>
        <ChevronDown className="icon arena-switch-chevron" aria-hidden="true" />
      </button>
      {/* tabIndex -1: a click on the list's text focuses the list, not the page, so the list stays open. */}
      <div className="arena-pop" id={panel} hidden={!open} tabIndex={-1}>
        <p className="arena-pop-title">Arena sites</p>
        <ArenaList
          className="arena-list"
          onPick={() => {
            // The picked link is about to be hidden with the panel: keep focus on the button, as Escape does.
            setOpen(false);
            button.current?.focus();
          }}
        />
      </div>
    </div>
  );
}

/** The other Arenas in the phone menu, where the header has no room for the button. */
export function ArenaMenuLinks() {
  return (
    <div className="nav-arenas">
      <p className="nav-arenas-title">Other Arena sites</p>
      {OTHERS.map((a) => (
        <a key={a.id} href={a.url} target="_blank" rel="noopener noreferrer">
          <ArenaMark id={a.id} />
          {a.name}
          {newTab}
        </a>
      ))}
    </div>
  );
}

/** The footer's row of all the Arenas. */
export function ArenaFamily() {
  return (
    <div className="arena-family">
      <h2>Arena sites</h2>
      <p>Learn another language the same way, free.</p>
      <ArenaList className="arena-cards" />
    </div>
  );
}
