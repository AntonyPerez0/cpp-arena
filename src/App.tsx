import { BrowserRouter, NavLink, Route, Routes, Link, useLocation } from "react-router-dom";
import { useEffect, useRef } from "react";
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

function Crosshair() {
  return (
    <svg viewBox="0 0 64 64" width="26" height="26" aria-hidden="true">
      <circle cx="32" cy="32" r="18" fill="none" stroke="currentColor" strokeWidth="5" />
      <path d="M32 4v16M32 44v16M4 32h16M44 32h16" stroke="currentColor" strokeWidth="5" strokeLinecap="round" />
      <circle cx="32" cy="32" r="4" fill="currentColor" />
    </svg>
  );
}

function ThemeToggle() {
  const theme = useResolvedTheme();
  const next = theme === "dark" ? "light" : "dark";
  return (
    <button className="theme-toggle" onClick={() => patchSettings({ theme: next })} aria-label={`Switch to ${next} theme`} title={`Switch to ${next} theme`}>
      {theme === "dark" ? (
        <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
          <circle cx="12" cy="12" r="4.5" fill="currentColor" />
          <path d="M12 1.5v3M12 19.5v3M1.5 12h3M19.5 12h3M4.6 4.6l2.1 2.1M17.3 17.3l2.1 2.1M4.6 19.4l2.1-2.1M17.3 6.7l2.1-2.1" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
      ) : (
        <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
          <path d="M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5z" fill="currentColor" />
        </svg>
      )}
    </button>
  );
}

function Footer() {
  return (
    <footer className="footer">
      <nav aria-label="More">
        <Link to="/topics">C and C++ topics</Link>
        <Link to="/visualize">Watch code run</Link>
        <Link to="/daily">Daily challenge</Link>
        <Link to="/placement">Placement quiz</Link>
        <Link to="/deathmatch">Interview prep</Link>
        <Link to="/certificate">Certificates</Link>
        <Link to="/next">Where to go next</Link>
        <Link to="/playground">Playground</Link>
        <a href={`${REPO_URL}/issues/new`} target="_blank" rel="noopener noreferrer">
          Report a problem<span className="visually-hidden"> (opens GitHub in a new tab)</span>
        </a>
        <a href={REPO_URL} target="_blank" rel="noopener noreferrer">
          Source on GitHub<span className="visually-hidden"> (opens in a new tab)</span>
        </a>
      </nav>
      <p className="muted small">Free and open source. Your progress stays in your browser unless you choose to sync it.</p>
    </footer>
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
      <header className="topbar">
        <Link to="/" className="brand" aria-label="C/C++ Arena home">
          <Crosshair />
          <span>
            C/C++ <b>Arena</b>
          </span>
        </Link>
        <nav className="nav" aria-label="Main">
          <NavLink to="/learn">Learn</NavLink>
          <NavLink to="/deathmatch">Deathmatch</NavLink>
          <NavLink to="/daily">Daily</NavLink>
          <NavLink to="/projects">Projects</NavLink>
          <NavLink to="/playground">Playground</NavLink>
          <NavLink to="/pro">Pro</NavLink>
          <NavLink to="/profile">Profile</NavLink>
        </nav>
        <div className="topbar-right">
          <CompilerBadge compact />
          <ThemeToggle />
        </div>
      </header>
      <main className="main" id="main" tabIndex={-1}>
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
      </main>
      <Footer />
    </BrowserRouter>
  );
}
