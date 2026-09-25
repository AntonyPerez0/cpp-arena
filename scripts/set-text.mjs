// Replaces lesson step texts from a Markdown file, keeping the YAML as the one
// source of truth. The file holds sections like:
//
//   === c-hello-1
//   Markdown for step c-hello-1...
//
// Usage: node scripts/set-text.mjs <file.md> [more.md ...]
import fs from "node:fs";
import path from "node:path";
import YAML from "yaml";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const dir = path.join(ROOT, "content/lessons");
const texts = new Map();
for (const f of process.argv.slice(2)) {
  const parts = fs.readFileSync(f, "utf8").split(/^=== (\S+)\s*$/m);
  for (let i = 1; i < parts.length; i += 2) texts.set(parts[i], parts[i + 1].replace(/^\n+/, "").replace(/\s*$/, "\n"));
}
let changed = 0;
for (const f of fs.readdirSync(dir).filter((x) => x.endsWith(".yaml"))) {
  const file = path.join(dir, f);
  const doc = YAML.parseDocument(fs.readFileSync(file, "utf8"));
  const steps = doc.get("steps");
  let touched = false;
  for (const step of steps.items) {
    const id = step.get("id");
    if (!texts.has(id)) continue;
    const node = doc.createNode(texts.get(id));
    node.type = "BLOCK_LITERAL";
    step.set("text", node);
    texts.delete(id);
    touched = true;
    changed++;
  }
  if (touched) fs.writeFileSync(file, doc.toString({ lineWidth: 0 }));
}
if (texts.size) {
  console.error("No step with id: " + [...texts.keys()].join(", "));
  process.exit(1);
}
console.log(`updated ${changed} step text(s)`);
