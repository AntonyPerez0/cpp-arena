// `npm run content [-- --no-cache]`: build and verify the lessons, drills and
// projects, then record the visualizations. Both get the same arguments.
import { spawnSync } from "node:child_process";
import path from "node:path";

const dir = path.dirname(new URL(import.meta.url).pathname);
for (const script of ["build-content.mjs", "build-visuals.mjs"]) {
  const r = spawnSync(process.execPath, [path.join(dir, script), ...process.argv.slice(2)], { stdio: "inherit" });
  if (r.status !== 0) process.exit(r.status ?? 1);
}
