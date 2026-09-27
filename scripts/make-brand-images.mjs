// Draws the brand images from one logo: public/favicon.svg, the app icons (192, 512 and a
// maskable 512 for Android home screens) and public/og-image.png, the 1200 x 630 picture
// shown when a link is shared. The share image names no counts, so it never goes stale.
// The logo matches src/components/Brand.tsx.
// Usage: node scripts/make-brand-images.mjs   (needs Playwright's Chromium, as for the e2e tests)
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { chromium } from "playwright";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const GLYPH = `<path d="M17.6 10.1a7.2 7.2 0 1 0 0 11.8" fill="none" stroke="#1c1003" stroke-width="3.4" stroke-linecap="round"/><path d="M23.4 12.6v6.8M20 16h6.8" stroke="#1c1003" stroke-width="3" stroke-linecap="round"/>`;
const GRADIENT = `<linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fcd34d"/><stop offset="0.55" stop-color="#f59e0b"/><stop offset="1" stop-color="#ea580c"/></linearGradient>`;
/** The rounded tile, as in the site header. */
const MARK = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><defs>${GRADIENT}</defs><rect width="32" height="32" rx="8" fill="url(#g)"/><rect x="0.5" y="0.5" width="31" height="31" rx="7.5" fill="none" stroke="#fff" stroke-opacity="0.25"/>${GLYPH}</svg>`;
/** Full-bleed square with the glyph inside the maskable safe zone (the middle 80%). */
const MASKABLE = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><defs>${GRADIENT}</defs><rect width="32" height="32" fill="url(#g)"/><g transform="translate(16 16) scale(0.72) translate(-16 -16)">${GLYPH}</g></svg>`;

fs.writeFileSync(path.join(ROOT, "public/favicon.svg"), MARK + "\n");

const font = (f) => "file://" + path.join(ROOT, "node_modules", f);
const og = `<!doctype html><html><head><meta charset="utf-8"><style>
  @font-face { font-family: Inter; font-weight: 100 900; src: url("${font("@fontsource-variable/inter/files/inter-latin-wght-normal.woff2")}"); }
  @font-face { font-family: Mono; font-weight: 100 800; src: url("${font("@fontsource-variable/jetbrains-mono/files/jetbrains-mono-latin-wght-normal.woff2")}"); }
  * { box-sizing: border-box; }
  body { margin: 0; width: 1200px; height: 630px; overflow: hidden; background: #09090b; color: #f4f4f5; font-family: Inter, sans-serif; position: relative; }
  .bg { position: absolute; inset: 0; background:
    radial-gradient(55% 60% at 85% 35%, rgb(245 158 11 / 0.2), transparent 70%),
    linear-gradient(rgb(255 255 255 / 0.04) 1px, transparent 1px) 0 0 / 48px 48px,
    linear-gradient(90deg, rgb(255 255 255 / 0.04) 1px, transparent 1px) 0 0 / 48px 48px; }
  .wrap { position: relative; display: flex; height: 100%; padding: 70px 80px; gap: 56px; align-items: center; }
  .left { flex: 1.15; }
  .brand { display: flex; align-items: center; gap: 18px; font-size: 34px; font-weight: 700; letter-spacing: -0.02em; margin-bottom: 48px; }
  .brand svg { width: 60px; height: 60px; }
  h1 { font-size: 68px; line-height: 1.02; letter-spacing: -0.045em; font-weight: 750; margin: 0 0 26px; }
  h1 span { background: linear-gradient(95deg, #fcd34d, #f59e0b 45%, #ea580c); -webkit-background-clip: text; color: transparent; }
  p { font-size: 26px; color: #a1a1aa; margin: 0; line-height: 1.4; }
  .card { flex: 1; background: #111114; border: 1px solid #3a3a42; border-radius: 22px; overflow: hidden; box-shadow: 0 40px 80px -30px #000; }
  .bar { display: flex; gap: 9px; padding: 16px 20px; background: #18181b; border-bottom: 1px solid #26262b; }
  .bar i { width: 13px; height: 13px; border-radius: 50%; background: #f87171; } .bar i:nth-child(2) { background: #fbbf24; } .bar i:nth-child(3) { background: #4ade80; }
  pre { margin: 0; padding: 22px 24px; font-family: Mono, monospace; font-size: 19px; line-height: 1.7; color: #e4e4e7; }
  .k { color: #c792ea; } .f { color: #82aaff; } .s { color: #c3e88d; } .n { color: #f78c6c; } .p { color: #89ddff; }
  .ok { margin: 0 24px 22px; display: inline-flex; gap: 10px; align-items: center; font-size: 19px; font-weight: 600; color: #86efac; background: #0b1f14; border: 1px solid #1f5134; border-radius: 999px; padding: 7px 16px; }
</style></head><body><div class="bg"></div><div class="wrap">
  <div class="left">
    <div class="brand">${MARK}<span>C/C++ Arena</span></div>
    <h1>Learn C and C++ by <span>writing real code</span>.</h1>
    <p>A real compiler in your browser. Lessons, drills, projects, a playground and a Pro Track.</p>
  </div>
  <div class="card"><div class="bar"><i></i><i></i><i></i></div>
<pre><span class="p">#include</span> <span class="s">&lt;iostream&gt;</span>

<span class="k">int</span> <span class="f">main</span>() {
    std::cout &lt;&lt; <span class="s">"Hello, Arena!\\n"</span>;
    <span class="k">return</span> <span class="n">0</span>;
}</pre>
    <div class="ok">✓ All tests passed</div>
  </div>
</div></body></html>`;

const exe = process.env.CHROMIUM_PATH || (fs.existsSync("/opt/pw-browsers/chromium") ? "/opt/pw-browsers/chromium" : undefined);
const browser = await chromium.launch(exe ? { executablePath: exe } : { channel: "chromium" });
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "brand-"));
async function render(html, width, height, out, transparent = false) {
  const file = path.join(tmp, path.basename(out) + ".html");
  fs.writeFileSync(file, html);
  const page = await browser.newPage({ viewport: { width, height } });
  await page.goto("file://" + file);
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: path.join(ROOT, out), omitBackground: transparent });
  await page.close();
  console.log("wrote " + out);
}
const iconPage = (svg, size) => `<!doctype html><html><body style="margin:0;background:transparent">${svg.replace("<svg ", `<svg width="${size}" height="${size}" `)}</body></html>`;
await render(og, 1200, 630, "public/og-image.png");
await render(iconPage(MARK, 192), 192, 192, "public/icon-192.png", true);
await render(iconPage(MARK, 512), 512, 512, "public/icon-512.png", true);
await render(iconPage(MASKABLE, 512), 512, 512, "public/icon-maskable-512.png");
await browser.close();
fs.rmSync(tmp, { recursive: true });
