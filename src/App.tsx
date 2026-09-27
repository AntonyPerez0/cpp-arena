import { BrowserRouter, NavLink, Route, Routes, Link, useLocation } from "react-router-dom";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Menu, Moon, Sun, X } from "lucide-react";
import { BrandMark } from "./components/Brand";
import CompilerBadge from "./components/CompilerBadge";
import Home from "./pages/Home";
import Learn from "./pages/Learn";
import StepPage from "./pages/StepPage";
import Deathmatch from "./pages/Deathmatch";
import Projects from "./pages/Projects";
import ProjectPage from "./pages/ProjectPage";
import Profile from "./pages/Profile";
import Pro from "./pages/Pro";
import ProPage from "./pages/ProPage";
import NotFound from "./pages/NotFound";
import { VisualIndex, VisualPage } from "./pages/Visualize";
import Placement from "./pages/Placement";
import Daily from "./pages/Daily";
import { TopicIndex, TopicPage } from "./pages/Topics";
import Certificate from "./pages/Certificate";
import Next from "./pages/Next";
import Playground from "./pages/Playground";
import { patchSettings, useStore } from "./state/store";
import { useAppearance, useResolvedTheme } from "./lib/appearance";
import { REPO_URL } from "./lib/site";

/** On navigation: scroll to the top and move keyboard/screen-reader focus to the new page's content. */
function RouteChange() {
  const { pathname } = useLocation();
  const first = useRef(true);
  useEffect(() => {
    window.scrollTo(0, 0);
    if (first.current) {
      first.current = false;
      return;
    }
    const main = document.getElementById("main");
    const heading = main?.querySelector("h1");
    const target = heading instanceof HTMLElement ? heading : main;
    if (target && !target.hasAttribute("tabindex")) target.setAttribute("tabindex", "-1");
    target?.focus({ preventScroll: true });
  }, [pathname]);
  return null;
}

function ThemeToggle() {
  const theme = useResolvedTheme();
  const next = theme === "dark" ? "light" : "dark";
  return (
    <button className="theme-toggle" onClick={() => patchSettings({ theme: next })} aria-label={`Switch to ${next} theme`} title={`Switch to ${next} theme`}>
      {theme === "dark" ? <Sun className="icon" aria-hidden="true" /> : <Moon className="icon" aria-hidden="true" />}
    </button>
  );
}

const ext = (label: string) => <span className="visually-hidden"> ({label})</span>;

function FooterCol({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="footer-col">
      <h2>{title}</h2>
      <ul>{children}</ul>
    </div>
  );
}

function Footer() {
  return (
    <footer className="footer">
      <div className="footer-inner">
        <div className="footer-grid">
          <div className="footer-brand">
            <Link to="/" className="brand" aria-label="C/C++ Arena home">
              <BrandMark />
              <span className="brand-name">
                C/C++ <b>Arena</b>
              </span>
            </Link>
            <p>Learn C and C++ with a real compiler that runs right in your browser.</p>
          </div>
          <FooterCol title="Learn">
            <li><Link to="/learn">Curriculum</Link></li>
            <li><Link to="/projects">Projects</Link></li>
            <li><Link to="/pro">Pro Track</Link></li>
            <li><Link to="/topics">C and C++ topics</Link></li>
          </FooterCol>
          <FooterCol title="Practice">
            <li><Link to="/deathmatch">Deathmatch</Link></li>
            <li><Link to="/daily">Daily challenge</Link></li>
            <li><Link to="/deathmatch">Interview prep</Link></li>
            <li><Link to="/placement">Placement quiz</Link></li>
          </FooterCol>
          <FooterCol title="Tools">
            <li><Link to="/playground">Playground</Link></li>
            <li><Link to="/visualize">Watch code run</Link></li>
            <li><Link to="/certificate">Certificates</Link></li>
            <li><Link to="/next">Where to go next</Link></li>
          </FooterCol>
          <FooterCol title="Project">
            <li>
              <a href={REPO_URL} target="_blank" rel="noopener noreferrer">
                Source on GitHub{ext("opens in a new tab")}
              </a>
            </li>
            <li>
              <a href={`${REPO_URL}/issues/new`} target="_blank" rel="noopener noreferrer">
                Report a problem{ext("opens GitHub in a new tab")}
              </a>
            </li>
            <li><Link to="/profile">Your progress</Link></li>
          </FooterCol>
        </div>
        <div className="footer-bottom">
          <p>© {new Date().getFullYear()} C/C++ Arena. Free and open source.</p>
          <p>Your progress stays in your browser unless you choose to sync it.</p>
        </div>
      </div>
    </footer>
  );
}

const NAV: [string, string][] = [
  ["/learn", "Learn"],
  ["/deathmatch", "Deathmatch"],
  ["/daily", "Daily"],
  ["/projects", "Projects"],
  ["/playground", "Playground"],
  ["/pro", "Pro"],
  ["/profile", "Profile"],
];

/** The site header: the full navigation on wide screens, a menu button on phones and tablets. */
function Header() {
  const [open, setOpen] = useState(false);
  const { pathname } = useLocation();
  const menuRef = useRef<HTMLButtonElement>(null);
  useEffect(() => setOpen(false), [pathname]);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        menuRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);
  return (
    <header className="topbar">
      <Link to="/" className="brand" aria-label="C/C++ Arena home">
        <BrandMark />
        <span className="brand-name">
          C/C++ <b>Arena</b>
        </span>
      </Link>
      <nav id="main-nav" className={open ? "nav nav-open" : "nav"} aria-label="Main">
        {NAV.map(([to, label]) => (
          <NavLink key={to} to={to}>
            {label}
          </NavLink>
        ))}
        <div className="nav-extra">
          <Link to="/topics">C and C++ topics</Link>
          <Link to="/visualize">Watch code run</Link>
          <Link to="/placement">Placement quiz</Link>
          <div className="nav-theme">
            <span>Theme</span>
            <ThemeToggle />
          </div>
        </div>
      </nav>
      <div className="topbar-right">
        <CompilerBadge compact />
        <ThemeToggle />
        <Link to="/learn" className="btn btn-primary btn-sm topbar-cta">
          Start learning
        </Link>
        <button
          ref={menuRef}
          className="icon-btn menu-btn"
          aria-expanded={open}
          aria-controls="main-nav"
          aria-label={open ? "Close menu" : "Open menu"}
          onClick={() => setOpen((o) => !o)}
        >
          {open ? <X className="icon" aria-hidden="true" /> : <Menu className="icon" aria-hidden="true" />}
        </button>
      </div>
    </header>
  );
}

/** Full-width pages (the landing page) lay out their own sections. */
function Main({ children }: { children: ReactNode }) {
  const { pathname } = useLocation();
  return (
    <main className={pathname === "/" ? "main main-full" : "main"} id="main" tabIndex={-1}>
      {children}
    </main>
  );
}

export default function App() {
  useAppearance();
  useStore((s) => s.settings.theme);
  return (
    <BrowserRouter basename={import.meta.env.BASE_URL.replace(/\/$/, "")}>
      <RouteChange />
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <Header />
      <Main>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/learn" element={<Learn />} />
          <Route path="/learn/:moduleId/:stepKey" element={<StepPage />} />
          <Route path="/deathmatch" element={<Deathmatch />} />
          <Route path="/projects" element={<Projects />} />
          <Route path="/projects/:projectId" element={<ProjectPage />} />
          <Route path="/pro" element={<Pro />} />
          <Route path="/pro/:projectId" element={<ProPage />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/placement" element={<Placement />} />
          <Route path="/daily" element={<Daily />} />
          <Route path="/certificate" element={<Certificate />} />
          <Route path="/next" element={<Next />} />
          <Route path="/playground" element={<Playground />} />
          <Route path="/topics" element={<TopicIndex />} />
          <Route path="/topics/:slug" element={<TopicPage />} />
          <Route path="/visualize" element={<VisualIndex />} />
          <Route path="/visualize/:id" element={<VisualPage />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </Main>
      <Footer />
    </BrowserRouter>
  );
}
