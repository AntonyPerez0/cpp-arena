// Small regex-based C/C++ highlighter for read-only snippets (fill-in steps, drills).
import type { ReactNode } from "react";

const KEYWORDS = new Set(
  (
    "auto break case catch class const constexpr consteval constinit continue default delete do else enum explicit extern for friend goto if inline mutable namespace new noexcept nullptr operator private protected public return sizeof static static_assert struct switch template this throw try typedef typename union using virtual volatile while override final concept requires co_await true false NULL"
  ).split(" "),
);
const TYPES = new Set(
  "void int char short long float double bool unsigned signed size_t string vector map set unordered_map unique_ptr shared_ptr weak_ptr optional variant pair tuple array span string_view FILE uint8_t int32_t int64_t uint32_t uint64_t".split(" "),
);

const TOKEN = /(\/\/[^\n]*|\/\*[\s\S]*?\*\/)|("(?:\\.|[^"\\\n])*"|'(?:\\.|[^'\\\n])*')|(^[ \t]*#[^\n]*)|(\b\d+(?:\.\d+)?(?:[eE][+-]?\d+)?[uUlLfF]*\b|\b0x[0-9a-fA-F]+\b)|([A-Za-z_]\w*)/gm;

export function highlight(code: string, keyPrefix = ""): ReactNode[] {
  const out: ReactNode[] = [];
  let last = 0;
  let k = 0;
  for (const m of code.matchAll(TOKEN)) {
    if (m.index! > last) out.push(code.slice(last, m.index));
    const text = m[0];
    let cls = "";
    if (m[1]) cls = "tk-com";
    else if (m[2]) cls = "tk-str";
    else if (m[3]) cls = "tk-pre";
    else if (m[4]) cls = "tk-num";
    else if (m[5]) cls = KEYWORDS.has(text) ? "tk-kw" : TYPES.has(text) ? "tk-type" : /^\s*\(/.test(code.slice(m.index! + text.length)) ? "tk-fn" : "";
    out.push(cls ? <span key={keyPrefix + k++} className={cls}>{text}</span> : text);
    last = m.index! + text.length;
  }
  if (last < code.length) out.push(code.slice(last));
  return out;
}

export function CodeView({ code, className = "" }: { code: string; className?: string }) {
  return <pre tabIndex={0} className={"codeview " + className}>{highlight(code)}</pre>;
}
