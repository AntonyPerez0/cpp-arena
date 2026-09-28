// The generated content with every step's extra challenges put back in `step.more`, for scripts
// that check or render all of it (the app loads the challenges on demand instead).
import fs from "node:fs";

export function loadContent(root = new URL("..", import.meta.url)) {
  const read = (f) => JSON.parse(fs.readFileSync(new URL(`src/generated/${f}`, root), "utf8"));
  const content = read("content.json");
  const challenges = read("challenges.json");
  for (const m of content.modules) for (const s of m.steps) if (challenges[s.id]) s.more = challenges[s.id];
  return content;
}
