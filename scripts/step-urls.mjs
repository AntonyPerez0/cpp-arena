// Step addresses: /learn/<module>/<slug>. Slugs come from step titles but are pinned in
// content/step-urls.yaml, so editing a title or inserting a step never moves a lesson's
// address. The same file keeps the old numbered links (/learn/<module>/<n>) working:
// each module lists the step each number pointed to.
import fs from "node:fs";
import YAML from "yaml";

export const STEP_URLS_FILE = "content/step-urls.yaml";

const HEADER = `# Lesson step addresses. Generated and updated by \`npm run content\`; commit it.
#
# slugs: every step's address, /learn/<module>/<slug>. A new step gets one from its
#   title the first time the content is built. After that it never changes, even if
#   the title does, so shared links and search results keep working.
# numbered: the old numbered addresses, /learn/<module>/<n>. Item n is the step that
#   number used to open, so old links still land on the same lesson.
`;

export function slugify(title) {
  return (
    title
      .toLowerCase()
      .replace(/c\+\+/g, "cpp")
      .replace(/&/g, " and ")
      .replace(/['’]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "step"
  );
}

export function readStepUrls(root) {
  const file = `${root}/${STEP_URLS_FILE}`;
  if (!fs.existsSync(file)) return { slugs: {}, numbered: {} };
  const data = YAML.parse(fs.readFileSync(file, "utf8")) ?? {};
  return { slugs: data.slugs ?? {}, numbered: data.numbered ?? {} };
}

export function writeStepUrls(root, urls) {
  const doc = new YAML.Document({ slugs: urls.slugs, numbered: urls.numbered });
  // One line per module keeps the numbered lists readable.
  for (const item of doc.get("numbered").items) item.value.flow = true;
  fs.writeFileSync(`${root}/${STEP_URLS_FILE}`, HEADER + doc.toString({ lineWidth: 0 }));
}

/**
 * Gives every step its `slug` and every module whose numbering changed a `numbered`
 * list (step ids by old position). New steps get pinned slugs; returns true if the
 * file needs writing. `errors` gets duplicate slugs.
 */
export function applyStepUrls(modules, urls, errors, warnings) {
  let changed = false;
  const known = new Set();
  for (const m of modules) {
    const used = new Set();
    const pinned = new Set(m.steps.map((s) => urls.slugs[s.id]).filter(Boolean));
    for (const s of m.steps) {
      known.add(s.id);
      let slug = urls.slugs[s.id];
      if (!slug) {
        const base = slugify(s.title);
        slug = base;
        for (let k = 2; used.has(slug) || pinned.has(slug); k++) slug = `${base}-${k}`;
        urls.slugs[s.id] = slug;
        changed = true;
      }
      if (used.has(slug)) errors.push(`${m.id}: two steps have the address ${slug}`);
      if (/^\d+$/.test(slug)) errors.push(`${s.id}: address ${slug} would look like an old step number`);
      used.add(slug);
      s.slug = slug;
    }
    // New modules (and positions past a module's old length) number like today.
    const old = urls.numbered[m.id] ?? [];
    if (!urls.numbered[m.id]) {
      urls.numbered[m.id] = m.steps.map((s) => s.id);
      changed = true;
    }
    const numbered = [...old, ...m.steps.slice(old.length).map((s) => s.id)];
    // A deleted step leaves a gap (null) rather than shifting the numbers after it.
    if (numbered.some((id, i) => m.steps[i]?.id !== id)) m.numbered = numbered.map((id) => (m.steps.some((s) => s.id === id) ? id : null));
  }
  for (const id of Object.keys(urls.slugs)) if (!known.has(id)) warnings.push(`${STEP_URLS_FILE}: step ${id} no longer exists; its address now shows "not found"`);
  return changed;
}
