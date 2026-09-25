// CodeMirror colors for the light theme, matching the site's own syntax colors
// (every token keeps at least 4.5:1 contrast, including on the active line).
import { EditorView } from "@codemirror/view";
import { HighlightStyle, syntaxHighlighting } from "@codemirror/language";
import { tags as t } from "@lezer/highlight";

const style = HighlightStyle.define([
  { tag: [t.keyword, t.controlKeyword, t.modifier, t.operatorKeyword, t.definitionKeyword, t.bool, t.null, t.self], color: "#7a2fae" },
  { tag: [t.typeName, t.standard(t.typeName), t.className, t.namespace], color: "#805300" },
  { tag: [t.string, t.character, t.special(t.string)], color: "#2b6e1f" },
  { tag: [t.number, t.integer, t.float], color: "#a8401b" },
  { tag: [t.comment, t.lineComment, t.blockComment], color: "#545c6a", fontStyle: "italic" },
  { tag: [t.processingInstruction, t.meta, t.macroName], color: "#0a6590" },
  { tag: [t.function(t.variableName), t.function(t.propertyName)], color: "#2448a8" },
  { tag: [t.escape, t.regexp], color: "#8a3a00" },
  { tag: t.invalid, color: "#b8192c" },
]);

export const lightEditorTheme = [
  EditorView.theme(
    {
      "&": { backgroundColor: "#f7f8fa", color: "#1e232b" },
      ".cm-content": { caretColor: "#1e232b" },
      ".cm-gutters": { backgroundColor: "#f7f8fa", color: "#545c6a", borderRight: "1px solid #d3d8e0" },
      ".cm-activeLine": { backgroundColor: "#eef1f5" },
      ".cm-activeLineGutter": { backgroundColor: "#e6e9ee", color: "#1e232b" },
      "&.cm-focused .cm-selectionBackground, .cm-selectionBackground, ::selection": { backgroundColor: "#cfe0f7" },
      ".cm-matchingBracket": { backgroundColor: "#dde6f2", outline: "1px solid #a9b1bd" },
    },
    { dark: false },
  ),
  syntaxHighlighting(style),
];
