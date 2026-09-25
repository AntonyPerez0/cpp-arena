# C/C++ Arena

Live at **https://cpparena.com**.

Learn C and C++ from zero to advanced, freeCodeCamp style, with **real compilation in your browser**.

- **Learn**: 44 modules, 277 steps, from `printf` to professional C++. C first (basics, pointers, memory, structs, linked lists, bits, then real-world C: files, function pointers and callbacks, integer types and undefined behavior, organizing programs with headers, `static`/`extern`, `argv` and exit codes). Then C++ (classes, RAII, operators, the STL, streams, iterators, lambdas, smart pointers, move semantics, templates, polymorphism, C++20, error handling), professional C++ (writing iterators and containers, variadic templates and type traits, `std::format` and `chrono`, design patterns), data structures and algorithms (complexity, searching, sorting, hash tables, trees and heaps, graphs), and a code-review capstone. Early steps are fill-in-the-blank; later steps have you write most of the code. Every step has hints you reveal one at a time and a "show solution" escape hatch.
- **Deathmatch**: endless reps drawn from the topics you've unlocked. Predict the output, fill the token, spot the bug, will it compile. Instant checks keep the respawn fast, and every 8th rep is a compiled boss rep. One life (ranked), three lives (casual), or a spaced-review warm-up that feeds you what you missed. 503 drills, CS-style ranks from Silver I to The Global Elite.
- **Projects**: 11 multi-milestone builds, from a calculator and a text adventure to a dynamic array, a memory allocator, a matrix library, your own `vector<T>`, an expression interpreter and a buy-menu economy.
- **Pro Track**: 12 projects done on a real machine (GitHub Codespaces or Linux/macOS) with professional tools: CMake, Git and pull requests, gdb and sanitizers, GoogleTest (graded by mutation testing), exceptions, threads and ThreadSanitizer, clang-tidy and clang-format, profiling, third-party libraries, POSIX processes and sockets, and two capstones (a multi-threaded key-value server and a C library). Each project is graded by GitHub Actions in the learner's own repository. See [`pro-track/`](pro-track/README.md).

Everything you submit is compiled by Clang 20 running as WebAssembly in a Web Worker and executed on a WASI runtime, with a 3 second time limit for infinite loops. Each run gets its own in-memory folder, so lessons can read and write files, and tests can pass command-line arguments and check exit codes. Compiler errors come with plain-English explanations. There is no server: the site is static and works on GitHub Pages.

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

## Run locally

```bash
npm install        # also copies the Clang toolchain into public/toolchain
npm run dev        # http://localhost:5173/
```

Other scripts:

| Script | What it does |
|---|---|
| `npm run content` | Rebuilds `src/generated/content.json` from `content/**/*.yaml`, compiling and running everything with GCC/G++ |
| `npm run verify:wasm` | Cross-checks all content against the exact browser toolchain (browsercc Clang in Node) |
| `npm run build` | Type-checks and builds `dist/` |
| `npm run test:e2e` | Serves `dist/` and drives the real UI in headless Chromium, including axe accessibility scans (WCAG 2.2 AA) of every page type and SEO checks |
| `npm run check:pro` | Checks every Pro Track grader: the starter must fail and the reference solution must pass (needs the tools from `pro-track/starter/tools/setup.sh`) |

## How it works

- **Compiler**: [browsercc](https://github.com/BertalanD/browsercc) (Clang/LLD 20 compiled to WebAssembly, MIT license). `src/compiler/core.js` compiles the big wasm modules once and re-instantiates them per compile. The toolchain (about 95 MB, plus a 19 MB precompiled C++ standard library header) downloads once and is kept in Cache Storage.
- **Flags**: C uses `-std=c17 -O1 -Wall -Wextra`. C++ uses `-std=c++20 -O2 -fno-exceptions -Wall -Wextra` with the precompiled header, which is why a warm C++ compile takes about a second.
- **Running**: each run happens in a short-lived worker with `@bjorn3/browser_wasi_shim`. stdin is supplied up front, output is capped at 64 KB, and the worker is killed after 3 seconds.
- **Grading**: stdout steps compare normalized output against test cases (some hidden, so hard-coding answers fails). Function steps append a hidden `main()` that calls your code and reports `@@PASS`/`@@FAIL` lines. Steps can also require or forbid patterns (for example "use a for loop").
- **Progress**: stored in your browser's localStorage. Export and import it from the Profile page.

## Accessibility and SEO

- **Accessibility** targets WCAG 2.2 AA: a skip link, focus moved to each new page's heading, visible focus rings, labeled editor and blanks, results announced to screen readers, keyboard access to every drill, an option to turn off single-key shortcuts, 24px tap targets, sufficient contrast (including syntax colors), and reduced motion support. `npm run test:e2e` runs axe-core on every page type and on interactive states (results, drills, the death screen), and CI fails on any violation.
- **SEO**: every page has a real URL (`/learn/c-hello/1`); old `#/` links redirect. `scripts/prerender.mjs` writes a static HTML file per route with its own title, description, canonical link, Open Graph tags, structured data (`Course`, `LearningResource`) and the lesson text, plus `sitemap.xml`, `robots.txt` and `404.html`. The build reads `BASE_PATH` (default `/`) and `SITE_URL` (default `https://cpparena.com`); the workflow sets both from `CUSTOM_DOMAIN`.

## Known limits

- No C++ exceptions or threads (WASI). The error-handling module teaches the exception-free patterns, and the Pro Track teaches exceptions and concurrency on a real machine.
- WebAssembly memory is only bounds-checked at its outer edge, so many out-of-bounds bugs won't crash the way they do natively.
- Programs can't read input interactively; each test supplies stdin in advance. Use "Run with my input" to try your own.
- Because C++ compiles with a precompiled `<bits/stdc++.h>`, a missing `#include` in C++ code still compiles here. The GCC check in CI uses real includes.

## Writing content

Content lives in YAML under `content/`:

- `content/lessons/NN-id.yaml`: a module with `steps`. A step has a unique, permanent `id` (saved progress is keyed by it, so never renumber ids), `title`, `text` (Markdown), `hints`, and either `fill:` (code with `[[answer]]` blanks) or `seed:` + `solution:`. Add `tests:` with `stdin:` for programs, or `harness:` (a hidden `main` using `CHECK`, `CHECK_INT`, `CHECK_STR`, `CHECK_DBL` in C, or `CHECK` and `CHECK_EQ` in C++) for function steps. A test can also give `files:` (name to contents, placed in the program's working folder), `args:` (command-line arguments) and `exit:` (the expected exit code). Optional `require:`/`forbid:` rules take a regex `pattern` and a `message`.
- `content/drills/<module-id>.yaml`: drills of type `predict`, `fill`, `bug` (mark the line with `// BUG` and give `fix:`), `compiles` and `boss` (an exercise like a lesson step). `pre:` holds code above `main`; `body:` goes inside `main`.
- `content/projects/NN-id.yaml`: a `seed` and `milestones`, each with the full `solution` at that point. Your code carries forward between milestones.
- `content/pro.yaml`: the Pro Track project list. Each project's lesson is `pro-track/starter/projects/<dir>/README.md`.

Expected outputs are computed from the reference solutions by `npm run content`, so you never type them by hand. `python3 scripts/yaml-quote-fix.py content/*/*.yaml` quotes prose lines that contain colons.
