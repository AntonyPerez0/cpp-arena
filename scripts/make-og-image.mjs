// Renders public/og-image.png, the picture shown when a link to the site is shared
// (1200 x 630). It deliberately names no counts, so it never goes out of date.
// Usage: node scripts/make-og-image.mjs   (needs Playwright's Chromium, as for the e2e tests)
import fs from "node:fs";
import { chromium } from "playwright";

const html = `<!doctype html><html><head><meta charset="utf-8"><style>
  body { margin: 0; width: 1200px; height: 630px; background: #0d0f13; color: #e8eaf0;
         font-family: "DejaVu Sans", ui-sans-serif, system-ui, sans-serif; display: flex; flex-direction: column; justify-content: center; padding: 0 90px; box-sizing: border-box; }
  .brand { display: flex; align-items: center; gap: 22px; font-size: 50px; font-weight: 700; margin-bottom: 44px; }
  .brand b { color: #ff9f1c; }
  h1 { font-size: 66px; line-height: 1.08; margin: 0 0 34px; letter-spacing: -0.5px; }
  p { font-size: 31px; color: #9aa3b5; margin: 0; line-height: 1.35; }
</style></head><body>
  <div class="brand">
    <svg viewBox="0 0 64 64" width="84" height="84"><circle cx="32" cy="32" r="18" fill="none" stroke="#ff9f1c" stroke-width="5"/>
    <path d="M32 4v16M32 44v16M4 32h16M44 32h16" stroke="#ff9f1c" stroke-width="5" stroke-linecap="round"/><circle cx="32" cy="32" r="4" fill="#ff9f1c"/></svg>
    <span>C/C++ <b>Arena</b></span>
  </div>
  <h1>Learn C and C++ by writing real code</h1>
  <p>A real compiler in your browser · lessons · drills · projects · playground · Pro Track</p>
</body></html>`;

const exe = process.env.CHROMIUM_PATH || (fs.existsSync("/opt/pw-browsers/chromium") ? "/opt/pw-browsers/chromium" : undefined);
const browser = await chromium.launch(exe ? { executablePath: exe } : { channel: "chromium" });
const page = await browser.newPage({ viewport: { width: 1200, height: 630 } });
await page.setContent(html);
await page.screenshot({ path: "public/og-image.png" });
await browser.close();
console.log("wrote public/og-image.png");
