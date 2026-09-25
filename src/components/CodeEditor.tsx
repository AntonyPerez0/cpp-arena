import { useId, useMemo } from "react";
import CodeMirror from "@uiw/react-codemirror";
import { cpp } from "@codemirror/lang-cpp";
import { oneDark } from "@codemirror/theme-one-dark";
import { keymap, EditorView } from "@codemirror/view";
import { Prec } from "@codemirror/state";
import { linter, lintGutter, type Diagnostic as CmDiagnostic } from "@codemirror/lint";
import type { Diagnostic } from "../grader/friendly";
import { useResolvedTheme } from "../lib/appearance";
import { lightEditorTheme } from "./lightTheme";

type Props = {
  value: string;
  onChange: (v: string) => void;
  onRun?: () => void;
  diagnostics?: Diagnostic[];
  minHeight?: string;
  readOnly?: boolean;
  /** Accessible name for the editor. */
  label?: string;
};

export default function CodeEditor({ value, onChange, onRun, diagnostics = [], minHeight = "260px", readOnly, label = "Code editor" }: Props) {
  const helpId = useId();
  const theme = useResolvedTheme();
  const extensions = useMemo(() => {
    const diagSource = diagnostics.filter((d) => d.line > 0 && !d.inTests && d.severity !== "note");
    return [
      cpp(),
      EditorView.lineWrapping,
      EditorView.contentAttributes.of({ "aria-label": label, "aria-describedby": helpId }),
      lintGutter(),
      linter(
        (view): CmDiagnostic[] =>
          diagSource
            .filter((d) => d.line <= view.state.doc.lines)
            .map((d) => {
              const line = view.state.doc.line(d.line);
              const from = Math.min(line.from + Math.max(d.col - 1, 0), line.to);
              return { from, to: Math.max(from, line.to), severity: d.severity === "error" ? "error" : "warning", message: d.friendly ? `${d.message}\n\n${d.friendly}` : d.message };
            }),
        { delay: 0 },
      ),
      Prec.highest(
        keymap.of([
          {
            key: "Mod-Enter",
            run: () => {
              onRun?.();
              return true;
            },
          },
        ]),
      ),
    ];
  }, [diagnostics, onRun, label, helpId]);

  return (
    <div className="editor">
      <p id={helpId} className="visually-hidden">
        Tab inserts indentation. To leave the editor with the keyboard, press Escape, then Tab. Control or Command plus Enter runs the checks.
      </p>
      <CodeMirror
        value={value}
        onChange={onChange}
        theme={theme === "light" ? lightEditorTheme : oneDark}
        extensions={extensions}
        minHeight={minHeight}
        readOnly={readOnly}
        basicSetup={{ tabSize: 4, foldGutter: false, highlightActiveLine: true, autocompletion: true }}
        indentWithTab
        onCreateEditor={(view) => {
          (window as unknown as { __cmView?: unknown }).__cmView = view;
        }}
      />
    </div>
  );
}
