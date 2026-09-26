import type { MouseEvent } from "react";
import { useNavigate } from "react-router-dom";
import { nextPage } from "../content";
import Markdown from "../components/Markdown";
import { useTitle } from "../lib/title";

const BASE = import.meta.env.BASE_URL;

/** "Where to go next": books, practice, projects. Site links in the text stay inside the app. */
export default function Next() {
  useTitle("Where to go next");
  const nav = useNavigate();
  // The text links to site pages as /pro, /daily...; add the base path the site is served under.
  const text = nextPage.body.replace(/\]\(\//g, "](" + BASE);
  const onClick = (e: MouseEvent) => {
    const a = (e.target as HTMLElement).closest("a");
    const href = a?.getAttribute("href");
    if (!href || !href.startsWith(BASE) || e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
    e.preventDefault();
    nav("/" + href.slice(BASE.length));
  };
  return (
    <div className="narrow">
      <div className="page-head">
        <h1>Where to go next</h1>
      </div>
      <div onClick={onClick}>
        <Markdown text={text} className="card" top={2} />
      </div>
    </div>
  );
}
