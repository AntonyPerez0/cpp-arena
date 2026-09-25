import { useEffect, useRef, type RefObject } from "react";
import { EditorView } from "@codemirror/view";

// Keys that are slow to reach on a phone keyboard. `pair` keys put the cursor between the two characters.
const KEYS: { label: string; text: string; name: string; pair?: boolean; move?: number }[] = [
  { label: "Tab", text: "    ", name: "indent" },
  { label: "{ }", text: "{}", name: "braces", pair: true },
  { label: "( )", text: "()", name: "parentheses", pair: true },
  { label: "[ ]", text: "[]", name: "square brackets", pair: true },
  { label: ";", text: ";", name: "semicolon" },
  { label: "&", text: "&", name: "ampersand" },
  { label: "*", text: "*", name: "star" },
  { label: "->", text: "->", name: "arrow" },
  { label: "<<", text: "<<", name: "shift left" },
  { label: ">>", text: ">>", name: "shift right" },
  { label: '" "', text: '""', name: "double quotes", pair: true },
  { label: "' '", text: "''", name: "single quotes", pair: true },
  { label: "#", text: "#", name: "hash" },
  { label: "<", text: "<", name: "less than" },
  { label: ">", text: ">", name: "greater than" },
  { label: "=", text: "=", name: "equals" },
  { label: "!", text: "!", name: "exclamation mark" },
  { label: "|", text: "|", name: "bar" },
  { label: "%", text: "%", name: "percent" },
  { label: "_", text: "_", name: "underscore" },
  { label: "::", text: "::", name: "double colon" },
  { label: "\\n", text: "\\n", name: "newline escape" },
  { label: "←", text: "", name: "cursor left", move: -1 },
  { label: "→", text: "", name: "cursor right", move: 1 },
];

type Editable = HTMLInputElement | HTMLTextAreaElement | HTMLElement;

function insert(target: Editable, text: string, pair: boolean, move: number) {
  if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) {
    const start = target.selectionStart ?? target.value.length;
    const end = target.selectionEnd ?? start;
    if (move) {
      const p = Math.max(0, Math.min(target.value.length, start + move));
      target.setSelectionRange(p, p);
    } else {
      target.setRangeText(text, start, end, "end");
      if (pair) target.setSelectionRange(start + 1, start + 1);
      // Let React see the change.
      target.dispatchEvent(new Event("input", { bubbles: true }));
    }
    target.focus();
    return;
  }
  const view = EditorView.findFromDOM(target);
  if (!view) return;
  const { from, to } = view.state.selection.main;
  if (move) {
    const p = Math.max(0, Math.min(view.state.doc.length, from + move));
    view.dispatch({ selection: { anchor: p } });
  } else {
    view.dispatch({ changes: { from, to, insert: text }, selection: { anchor: from + (pair ? 1 : text.length) }, scrollIntoView: true });
  }
  view.focus();
}

/**
 * A row of tap-to-insert symbols for touch screens. It types into whichever
 * code editor or answer box inside `container` was focused last.
 */
export default function SymbolBar({ container }: { container: RefObject<HTMLElement> }) {
  const last = useRef<Editable | null>(null);
  useEffect(() => {
    const el = container.current;
    if (!el) return;
    const onFocus = (e: FocusEvent) => {
      const t = e.target as HTMLElement;
      if (t instanceof HTMLInputElement && t.type === "text") last.current = t;
      else if (t instanceof HTMLTextAreaElement) last.current = t;
      else if (t.closest?.(".cm-content")) last.current = t.closest(".cm-content") as HTMLElement;
    };
    el.addEventListener("focusin", onFocus);
    return () => el.removeEventListener("focusin", onFocus);
  }, [container]);

  const target = (): Editable | null => {
    if (last.current?.isConnected) return last.current;
    const el = container.current;
    return (el?.querySelector(".cm-content, input.blank, input.answer-input") as Editable | null) ?? null;
  };

  return (
    <div className="symbar" role="toolbar" aria-label="Insert symbols">
      {KEYS.map((k) => (
        <button
          key={k.name}
          type="button"
          className="symkey"
          aria-label={k.name}
          // Keep focus (and the phone keyboard) in the editor.
          onPointerDown={(e) => e.preventDefault()}
          onClick={() => {
            const t = target();
            if (t) insert(t, k.text, !!k.pair, k.move ?? 0);
          }}
        >
          {k.label}
        </button>
      ))}
    </div>
  );
}
