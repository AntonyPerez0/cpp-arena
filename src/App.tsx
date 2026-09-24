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

export default function App() {
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
          <NavLink to="/projects">Projects</NavLink>
          <NavLink to="/pro">Pro</NavLink>
          <NavLink to="/profile">Profile</NavLink>
        </nav>
        <div className="topbar-right">
          <CompilerBadge compact />
        </div>
      </header>
      <main className="main" id="main" tabIndex={-1}>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/learn" element={<Learn />} />
          <Route path="/learn/:moduleId/:stepNo" element={<StepPage />} />
          <Route path="/deathmatch" element={<Deathmatch />} />
          <Route path="/projects" element={<Projects />} />
          <Route path="/projects/:projectId" element={<ProjectPage />} />
          <Route path="/pro" element={<Pro />} />
          <Route path="/pro/:projectId" element={<ProPage />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </main>
    </BrowserRouter>
  );
}
