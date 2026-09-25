import { useMemo } from "react";
import { marked } from "marked";
import { highlightHtml } from "./highlight";

marked.setOptions({ gfm: true, breaks: false });
// C and C++ code blocks get the same colors as the rest of the site.
marked.use({
  renderer: {
    code({ text, lang }) {
      if (lang !== "c" && lang !== "cpp") return false;
      return `<pre><code class="language-${lang}">${highlightHtml(text)}</code></pre>\n`;
    },
  },
});

// Moves every heading so the shallowest one becomes <h{top}>, keeping the page outline in order.
function shiftHeadings(html: string, top: number): string {
  const levels = [...html.matchAll(/<h([1-6])[\s>]/g)].map((m) => Number(m[1]));
  if (levels.length === 0) return html;
  const shift = top - Math.min(...levels);
  if (shift === 0) return html;
  return html.replace(/<(\/?)h([1-6])([\s>])/g, (_, slash, n, after) => `<${slash}h${Math.min(6, Math.max(1, Number(n) + shift))}${after}`);
}

/** Renders trusted lesson markdown (content is authored in this repo). `top` sets the level of the text's first heading. */
export default function Markdown({ text, className = "", top }: { text: string; className?: string; top?: number }) {
  // Code blocks can scroll sideways, so they must be reachable with the keyboard.
  const html = useMemo(() => {
    const out = (marked.parse(text, { async: false }) as string).replace(/<pre>/g, '<pre tabindex="0">');
    return top ? shiftHeadings(out, top) : out;
  }, [text, top]);
  return <div className={"md " + className} dangerouslySetInnerHTML={{ __html: html }} />;
}

export function InlineMd({ text }: { text: string }) {
  const html = useMemo(() => marked.parseInline(text, { async: false }) as string, [text]);
  return <span dangerouslySetInnerHTML={{ __html: html }} />;
}
