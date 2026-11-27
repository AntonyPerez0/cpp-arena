# Development

Running C/C++ Arena on your own computer, the npm scripts, and how the site is deployed. For how the site works, see [Architecture](architecture.md).

Paths written as code (such as `scripts/copy-toolchain.mjs`) are relative to the root of the repository.

## Run locally

```bash
npm install        # also copies the Clang toolchain into public/toolchain
npm run dev        # http://localhost:5173/
```

Other scripts:

| Script | What it does |
|---|---|
| `npm run content` | Rebuilds `src/generated/content.json` from `content/**/*.yaml`, compiling and running everything with GCC/G++, then records the visualizations with gdb (`scripts/build-visuals.mjs`) |
| `npm run verify:wasm` | Cross-checks all content against the exact browser toolchain (browsercc Clang in Node) |
| `npm run build` | Type-checks and builds `dist/` |
| `npm run test:e2e` | Serves `dist/` and drives the real UI in headless Chromium, including axe accessibility scans (WCAG 2.2 AA) of every page type and SEO checks |
| `npm run check:pro` | Checks every Pro Track grader: the starter must fail and the reference solution must pass (needs the tools from `pro-track/starter/tools/setup.sh`) |

## Deploy to GitHub Pages

1. Create an empty repository on GitHub (any name, for example `cpp-arena`).
2. Push this folder to it:

   ```bash
   cd cpp-arena
   git init -b main
   git add .
   git commit -m "C/C++ Arena"
   git remote add origin https://github.com/<you>/<repo>.git
   git push -u origin main
   ```

3. On GitHub, open **Settings > Pages** and set **Source** to **GitHub Actions**.

The workflow in `.github/workflows/deploy.yml` then runs on every push to `main`. It installs dependencies, compiles and runs every lesson solution, drill and project milestone with GCC (the build fails if any expected output is wrong), builds the site, runs the browser tests (including the accessibility checks), and publishes it.

The site address is set by `CUSTOM_DOMAIN` at the top of the workflow (`cpparena.com` here). To use your own domain, change it and enter the same domain under **Settings > Pages > Custom domain**. To publish at `https://<you>.github.io/<repo>/` instead, set `CUSTOM_DOMAIN` to an empty string; the workflow then passes the repository name to the build, so any repository name works.
