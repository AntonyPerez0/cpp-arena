// Writes a real HTML page for every route into dist/ (after `vite build`), so
// search engines and link previews see each lesson with its own title,
// description and text. The React app replaces the pre-rendered content when
// it starts. Also writes sitemap.xml, robots.txt and 404.html.
//
// Env: SITE_URL (default https://cpparena.com), BASE_PATH (default /).
import fs from "node:fs";
import path from "node:path";
import { marked } from "marked";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const DIST = path.join(ROOT, "dist");
// Host names are case-insensitive, but canonical links should match exactly what
// GitHub Pages serves (a lowercase host), even when the owner name has capitals.
const siteUrl = new URL(process.env.SITE_URL ?? "https://cpparena.com");
const SITE = `${siteUrl.protocol}//${siteUrl.host.toLowerCase()}${siteUrl.pathname}`.replace(/\/$/, "");
const BASE = process.env.BASE_PATH ?? "/";
const NAME = "C/C++ Arena";
const content = JSON.parse(fs.readFileSync(path.join(ROOT, "src/generated/content.json"), "utf8"));
const template = fs.readFileSync(path.join(DIST, "index.html"), "utf8");
const today = new Date().toISOString().slice(0, 10);

const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const link = (p) => BASE + p.replace(/^\//, "");
const md = (s) => marked.parse(s, { async: false });
/** Plain-text summary of Markdown, cut at a word boundary. */
function summary(text, max = 155) {
  const plain = text
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/^\s*(?:[-*+]|\d+\.)\s+/gm, "")
    .replace(/`([^`]*)`/g, "$1")
    .replace(/\*\*|__|\*|_|#+ /g, "")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/\|/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (plain.length <= max) return plain;
  const cut = plain.slice(0, max - 1);
  return cut.slice(0, cut.lastIndexOf(" ")) + "…";
}

const moduleCount = content.modules.length;
const stepCount = content.modules.reduce((n, m) => n + m.steps.length, 0);

const pages = [];
function page(route, { title, description, body, index = true, type = "website", jsonld = null }) {
  pages.push({ route, title, description, body, index, type, jsonld });
}

// ---------------------------------------------------------------- pages
const courseLd = {
  "@context": "https://schema.org",
  "@type": "Course",
  name: "Learn C and C++: from zero to professional",
  description: `A free interactive course with ${moduleCount} modules and ${stepCount} exercises compiled by a real C/C++ compiler in the browser, plus projects and a professional track.`,
  url: SITE + "/",
  isAccessibleForFree: true,
  inLanguage: "en",
  educationalLevel: "Beginner to advanced",
  teaches: ["C programming", "C++ programming", "Pointers and memory management", "Data structures and algorithms", "Modern C++20", "CMake, debugging and testing"],
  provider: { "@type": "Organization", name: NAME, url: SITE + "/" },
  hasCourseInstance: { "@type": "CourseInstance", courseMode: "online", courseWorkload: "PT120H" },
  offers: { "@type": "Offer", price: 0, priceCurrency: "USD", category: "Free" },
};

page("/", {
  title: `${NAME}: learn C and C++ with a real compiler in your browser`,
  description: `Free interactive C and C++ course: ${stepCount} exercises compiled by real Clang in your browser, from printf to C++20, data structures, projects and a professional track.`,
  jsonld: [courseLd, { "@context": "https://schema.org", "@type": "WebSite", name: NAME, url: SITE + "/" }],
  body: `<h1>Learn C and C++ by writing real code</h1>
<p>Every answer is compiled by a real Clang compiler running inside your browser. Work through ${moduleCount} modules from <code>printf</code> to C++20, drill the fundamentals in endless Deathmatch reps, ship projects milestone by milestone, and finish with a professional track on a real machine.</p>
<ul>
<li><a href="${link("/learn")}">Learn: ${moduleCount} modules, ${stepCount} steps</a></li>
<li><a href="${link("/deathmatch")}">Deathmatch: ${content.drills.length} drills</a></li>
<li><a href="${link("/projects")}">Projects: ${content.projects.length} multi-milestone builds</a></li>
<li><a href="${link("/pro")}">Pro Track: ${content.pro.length} projects graded by GitHub Actions</a></li>
</ul>`,
});

const phases = [];
for (const m of content.modules) {
  let ph = phases.find((p) => p.name === m.phase);
  if (!ph) phases.push((ph = { name: m.phase, modules: [] }));
  ph.modules.push(m);
}
page("/learn", {
  title: `All C and C++ lessons (${moduleCount} modules) | ${NAME}`,
  description: `The full curriculum: ${moduleCount} modules and ${stepCount} interactive steps covering C, C++, the standard library, modern C++, data structures and algorithms.`,
  body:
    `<h1>Learn</h1>` +
    phases
      .map(
        (ph) =>
          `<h2>${esc(ph.name)}</h2><ul>` +
          ph.modules.map((m) => `<li><a href="${link(`/learn/${m.id}/1`)}">${esc(m.title)}</a>: ${esc(m.summary)}</li>`).join("") +
          `</ul>`,
      )
      .join(""),
});

for (const m of content.modules) {
  m.steps.forEach((s, i) => {
    const prev = i > 0 ? `<a href="${link(`/learn/${m.id}/${i}`)}">Previous: ${esc(m.steps[i - 1].title)}</a>` : "";
    const next = i + 1 < m.steps.length ? `<a href="${link(`/learn/${m.id}/${i + 2}`)}">Next: ${esc(m.steps[i + 1].title)}</a>` : "";
    page(`/learn/${m.id}/${i + 1}`, {
      title: `${s.title} · ${m.title} (${m.lang === "c" ? "C" : "C++"}) | ${NAME}`,
      description: summary(s.text),
      type: "article",
      jsonld: {
        "@context": "https://schema.org",
        "@type": "LearningResource",
        name: s.title,
        description: summary(s.text),
        learningResourceType: "Exercise",
        interactivityType: "active",
        isAccessibleForFree: true,
        inLanguage: "en",
        programmingLanguage: m.lang === "c" ? "C" : "C++",
        isPartOf: { "@type": "Course", name: courseLd.name, url: SITE + "/" },
        url: `${SITE}/learn/${m.id}/${i + 1}/`,
      },
      body: `<nav aria-label="Breadcrumb"><a href="${link("/learn")}">Learn</a> › ${esc(m.phase)} › ${esc(m.title)}</nav>
<p>Step ${i + 1} of ${m.steps.length}</p>
<h1>${esc(s.title)}</h1>
${md(s.text)}
<p>${prev} ${next}</p>`,
    });
  });
}

page("/deathmatch", {
  title: `Deathmatch: endless C and C++ drills | ${NAME}`,
  description: `${content.drills.length} quick drills: predict the output, fill the token, spot the bug, will it compile. One life, ranked from Silver I to The Global Elite.`,
  body: `<h1>Deathmatch</h1><p>Endless reps from everything you've unlocked: predict the output, fill the token, spot the bug, will it compile. Every 8th rep is a boss rep you compile for real.</p>`,
});

page("/projects", {
  title: `C and C++ projects for beginners to advanced | ${NAME}`,
  description: `${content.projects.length} projects built milestone by milestone: a calculator, a text adventure, a memory allocator, your own vector<T>, an expression interpreter and more.`,
  body: `<h1>Projects</h1><ul>` + content.projects.map((p) => `<li><a href="${link(`/projects/${p.id}`)}">${esc(p.title)}</a>: ${esc(p.summary)}</li>`).join("") + `</ul>`,
});
for (const p of content.projects) {
  page(`/projects/${p.id}`, {
    title: `${p.title}: a ${p.lang === "c" ? "C" : "C++"} project | ${NAME}`,
    description: summary(p.summary),
    body: `<h1>${esc(p.title)}</h1><p>${esc(p.summary)}</p><h2>Milestones</h2><ol>${p.milestones.map((ms) => `<li>${esc(ms.title)}</li>`).join("")}</ol>`,
  });
}

page("/pro", {
  title: `Pro Track: professional C and C++ projects | ${NAME}`,
  description: `${content.pro.length} projects on a real machine with CMake, Git, gdb, sanitizers, GoogleTest, clang-tidy, profiling, threads and sockets, graded by GitHub Actions.`,
  body: `<h1>Pro Track</h1><ul>` + content.pro.map((p) => `<li><a href="${link(`/pro/${p.id}`)}">${esc(p.title)}</a>: ${esc(p.summary)}</li>`).join("") + `</ul>`,
});
for (const p of content.pro) {
  page(`/pro/${p.id}`, {
    title: `${p.title} | Pro Track | ${NAME}`,
    description: summary(p.summary),
    type: "article",
    body: `<h1>${esc(p.title)}</h1>${md(p.readme.replace(/^# .*\n+/, ""))}`,
  });
}

page("/profile", { title: `Your progress | ${NAME}`, description: "Your saved progress, ranks and settings.", index: false, body: `<h1>Profile</h1>` });

// ---------------------------------------------------------------- render
function render(p) {
  const url = p.route === "/" ? SITE + "/" : `${SITE}${p.route}/`;
  const head = [
    `<title>${esc(p.title)}</title>`,
    `<meta name="description" content="${esc(p.description)}" />`,
    p.index ? `<link rel="canonical" href="${url}" />` : `<meta name="robots" content="noindex" />`,
    `<meta property="og:site_name" content="${NAME}" />`,
    `<meta property="og:type" content="${p.type}" />`,
    `<meta property="og:title" content="${esc(p.title)}" />`,
    `<meta property="og:description" content="${esc(p.description)}" />`,
    `<meta property="og:url" content="${url}" />`,
    `<meta property="og:image" content="${SITE}/og-image.png" />`,
    `<meta property="og:image:alt" content="C/C++ Arena: learn C and C++ with a real compiler in your browser" />`,
    `<meta name="twitter:card" content="summary_large_image" />`,
    ...(p.jsonld ? [].concat(p.jsonld).map((j) => `<script type="application/ld+json">${JSON.stringify(j).replace(/</g, "\\u003c")}</script>`) : []),
  ].join("\n    ");
  const nav = `<header class="topbar"><a class="brand" href="${BASE}">${NAME}</a><nav class="nav" aria-label="Main">${[
    ["/learn", "Learn"],
    ["/deathmatch", "Deathmatch"],
    ["/projects", "Projects"],
    ["/pro", "Pro"],
    ["/profile", "Profile"],
  ]
    .map(([r, t]) => `<a href="${link(r)}">${t}</a>`)
    .join("")}</nav></header>`;
  return template
    .replace(/<title>[\s\S]*?<\/title>/, "")
    .replace(/<meta name="description"[^>]*>/, "")
    .replace("</head>", `  ${head}\n  </head>`)
    .replace('<div id="root"></div>', `<div id="root">${nav}<main id="main" class="main prerendered md">${p.body}</main></div>`);
}

let written = 0;
for (const p of pages) {
  const dir = p.route === "/" ? DIST : path.join(DIST, p.route);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, "index.html"), render(p));
  written++;
}

// GitHub Pages serves 404.html for unknown paths; the app then shows its "not found" page.
fs.writeFileSync(
  path.join(DIST, "404.html"),
  render({ route: "/404", title: `Page not found | ${NAME}`, description: "This page doesn't exist.", index: false, type: "website", body: `<h1>Page not found</h1><p><a href="${BASE}">Go to the home page</a></p>` }),
);

const indexed = pages.filter((p) => p.index);
fs.writeFileSync(
  path.join(DIST, "sitemap.xml"),
  `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
    indexed.map((p) => `  <url><loc>${p.route === "/" ? SITE + "/" : `${SITE}${p.route}/`}</loc><lastmod>${today}</lastmod></url>`).join("\n") +
    `\n</urlset>\n`,
);
// Search engines only read robots.txt at the domain root, so this one only counts when
// the site has its own domain; on a github.io project page, submit the sitemap in
// Google Search Console instead.
fs.writeFileSync(path.join(DIST, "robots.txt"), `User-agent: *\nAllow: /\n\nSitemap: ${SITE}/sitemap.xml\n`);
console.log(`prerender: ${written} pages, ${indexed.length} in sitemap.xml, 404.html, robots.txt`);
