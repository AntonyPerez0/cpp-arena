# C/C++ Arena

Live at **https://cpparena.com**.

Learn C and C++ from zero to advanced, freeCodeCamp style, with **real compilation in your browser**.

- **Learn**: 48 modules, 318 steps, from `printf` to professional C++. C first (basics, pointers, memory, structs and unions, linked lists, bits, random numbers, then real-world C: text and binary files, function pointers and callbacks, variadic functions, integer types, type punning and undefined behavior, where a program's data lives in memory, organizing programs with headers, `static`/`extern`, `argv` and exit codes). Then C++ (how C++ differs from C, classes, RAII, operators, the STL, streams, iterators, lambdas, smart pointers, move semantics, templates, polymorphism and casts, C++20, error handling and exceptions, `<random>`), professional C++ (writing iterators and containers, variadic templates, type traits, value categories, SFINAE and CRTP, `std::format` and `chrono`, design patterns and type erasure, attributes and consteval, threads, concurrency, memory ordering and lock-free stacks, performance: caches, data layout, branch prediction, false sharing and `std::pmr` allocators), data structures and algorithms (complexity, searching, sorting, hash tables, trees and heaps, graphs, backtracking, dynamic programming), and a code-review capstone. Early steps are fill-in-the-blank; later steps have you write most of the code. Every step has hints you reveal one at a time and a "show solution" escape hatch.
- **Deathmatch**: endless reps drawn from what you've learned: each drill unlocks when you finish the lesson step that teaches it (worked out at build time from the features the drill uses). Predict the output, fill the token, spot the bug, will it compile. Instant checks keep the respawn fast, and every 8th rep is a compiled boss rep. One life (ranked), three lives (casual), a spaced-review warm-up that feeds you what you missed, or interview prep. 655 drills (including 62 classic interview questions), CS-style ranks from Silver I to The Global Elite.
- **Projects**: 11 multi-milestone builds, from a calculator and a text adventure to a dynamic array, a memory allocator, a matrix library, your own `vector<T>`, an expression interpreter and a buy-menu economy.
- **Pro Track**: 12 projects done on a real machine (GitHub Codespaces or Linux/macOS) with professional tools: CMake, Git and pull requests, gdb and sanitizers, GoogleTest (graded by mutation testing), exceptions, threads and ThreadSanitizer, clang-tidy and clang-format, profiling, third-party libraries, POSIX processes and sockets, and two capstones (a multi-threaded key-value server and a C library). Each project is graded by GitHub Actions in the learner's own repository. See [`pro-track/`](pro-track/README.md).
- **Watch code run**: 30 visualizations that step through real programs line by line, drawing the stack, the heap and every pointer as an arrow. They're recorded at build time by running each program under gdb, and linked from the lesson steps they explain.
- **Playground** (`/playground`): run any C or C++ program with input, see compiler errors explained and crashes described, keep the code in the browser, and share it as a link that carries the code.
- **Topics**: 52 short reference pages (`/topics/...`) on the core ideas, each with a compiled and tested example, written for learners and for search engines. A "Where to go next" page (`/next`) collects books, practice sites and projects for after the course.
- **Daily challenge, placement quiz and certificates**: one problem a day with a streak, a 16-question quiz that lets experienced learners skip ahead, and printable certificates for finishing the course and the Pro Track.
- **Comfort**: lessons ask before downloading the compiler on mobile data or Data Saver, light and dark themes, adjustable text size, a symbol bar for phone keyboards, "Report a problem" on every exercise, progress sync (transfer link or QR code, or a private GitHub Gist), and offline use once visited (it can be installed to a phone's home screen).

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
| `npm run content` | Rebuilds `src/generated/content.json` from `content/**/*.yaml`, compiling and running everything with GCC/G++, then records the visualizations with gdb (`scripts/build-visuals.mjs`) |
| `npm run verify:wasm` | Cross-checks all content against the exact browser toolchain (browsercc Clang in Node) |
| `npm run build` | Type-checks and builds `dist/` |
| `npm run test:e2e` | Serves `dist/` and drives the real UI in headless Chromium, including axe accessibility scans (WCAG 2.2 AA) of every page type and SEO checks |
| `npm run check:pro` | Checks every Pro Track grader: the starter must fail and the reference solution must pass (needs the tools from `pro-track/starter/tools/setup.sh`) |

## How it works

- **Compiler**: [browsercc](https://github.com/BertalanD/browsercc) (Clang/LLD 20 compiled to WebAssembly, MIT license). `src/compiler/core.js` compiles the big wasm modules once and re-instantiates them per compile. The toolchain downloads once and is kept in Cache Storage: about 27 MB for C and 38 MB for C++ (the precompiled standard library header), because `scripts/copy-toolchain.mjs` also writes gzip copies of the files (88 and 107 MB uncompressed) and the compiler worker unpacks them as they arrive with `DecompressionStream`. Browsers without it fetch the full files.
- **C++ exceptions**: browsercc's C++ libraries are built without exceptions, so `vendor/libcxx-eh` holds libc++, libc++abi and libunwind 19.1.5 rebuilt with WebAssembly exception handling (`scripts/build-eh-runtime.sh` reproduces them from LLVM source), plus `libarena.a`, which lets the page print `terminate called after throwing an instance of '...'` for an uncaught exception. `scripts/copy-toolchain.mjs` swaps them into the sysroot and rebuilds the precompiled header to match. Browsers have supported WebAssembly exceptions since 2021 (Chrome 95, Firefox 100, Safari 15.2).
- **Flags**: C uses `-std=c17 -O1 -Wall -Wextra`. C++ uses `-std=c++20 -O2 -fwasm-exceptions -Wall -Wextra` with the precompiled header, which is why a warm C++ compile takes about a second.
- **Running**: each run happens in a short-lived worker with `@bjorn3/browser_wasi_shim`. stdin is supplied up front, output is capped at 64 KB, and the worker is killed after 3 seconds.
- **Grading**: stdout steps compare normalized output against test cases (some hidden, so hard-coding answers fails). Function steps append a hidden `main()` that calls your code and reports `@@PASS`/`@@FAIL` lines. Steps can also require or forbid patterns (for example "use a for loop").
- **Progress**: stored in your browser's localStorage. The Profile page moves it between devices with a transfer link (compressed into the address, also shown as a QR code), a private GitHub Gist (using a token with only the `gist` permission, kept in the browser), or a file. Imports merge rather than overwrite.
- **Visualizations**: `scripts/trace/tracer.py` is a gdb script that steps a program and records, at every line, each stack frame's variables, the live heap blocks (tracked by wrapping `malloc`/`free` and `new`/`delete`) and the output so far. Pointers are resolved to what they point at, so the page can draw arrows. Recordings go to `public/visuals/`.
- **Offline**: `public/sw.js` caches pages and built files after the first visit; the compiler worker caches the toolchain separately.
- **Analytics** (optional): set a repository variable `CF_BEACON_TOKEN` to a Cloudflare Web Analytics token and the build adds its cookie-free beacon. Without it, nothing is sent.

## Accessibility and SEO

- **Accessibility** targets WCAG 2.2 AA: a skip link, focus moved to each new page's heading, visible focus rings, labeled editor and blanks, results announced to screen readers, keyboard access to every drill, an option to turn off single-key shortcuts, 24px tap targets, sufficient contrast (including syntax colors), and reduced motion support. `npm run test:e2e` runs axe-core on every page type, in both the light and dark themes, and on interactive states (results, drills, the death screen, the visualizer), and CI fails on any violation.
- **SEO**: every page has a real URL (`/learn/c-hello/your-first-program`); old `#/` links and numbered step addresses redirect. `scripts/prerender.mjs` writes a static HTML file per route with its own title, description, canonical link, Open Graph tags, structured data (`Course`, `LearningResource`, `TechArticle`) and the lesson text, plus `sitemap.xml`, `robots.txt` and `404.html`. The build reads `BASE_PATH` (default `/`) and `SITE_URL` (default `https://cpparena.com`); the workflow sets both from `CUSTOM_DOMAIN`.

## Known limits

- No threads (WASI). The concurrency module's thread examples are `cpp native` code blocks, compiled with `-pthread` and run three times by `npm run content` (their output must match every time), while its exercises practice the parts that run without threads (atomics work). The Pro Track teaches exceptions and concurrency hands-on on a real machine.
- WebAssembly memory is only bounds-checked at its outer edge, so many out-of-bounds bugs won't crash the way they do natively.
- Programs can't read input interactively; each test supplies stdin in advance. Use "Run with my input" to try your own.
- Because C++ compiles with a precompiled `<bits/stdc++.h>`, a missing `#include` in C++ code still compiles here. The GCC check in CI uses real includes.

## Writing content

Content lives in YAML under `content/`:

- `content/lessons/NN-id.yaml`: a module with `steps`. A step has a unique, permanent `id` (saved progress is keyed by it, so never renumber ids), `title`, `text` (Markdown), `hints`, and either `fill:` (code with `[[answer]]` blanks) or `seed:` + `solution:`. Add `tests:` with `stdin:` for programs, or `harness:` (a hidden `main` using `CHECK`, `CHECK_INT`, `CHECK_STR`, `CHECK_DBL` in C, or `CHECK` and `CHECK_EQ` in C++) for function steps. A test can also give `files:` (name to contents, placed in the program's working folder), `args:` (command-line arguments) and `exit:` (the expected exit code). Optional `require:`/`forbid:` rules take a regex `pattern` and a `message`. Worked examples in `text` are fenced as `c run` or `cpp run` (compiled, run, and compared with the `output` block after them) or `cpp native` for thread code the browser can't build (compiled with `-pthread` and run three times at build time only).
- `content/drills/<module-id>.yaml`: drills of type `predict`, `fill`, `bug` (mark the line with `// BUG` and give `fix:`), `compiles` and `boss` (an exercise like a lesson step). `pre:` holds code above `main`; `body:` goes inside `main`. The build works out which step teaches each drill (`scripts/drill-steps.mjs`); set `after: <step id>` to choose it yourself.
- `content/step-urls.yaml`: every step's permanent address (`/learn/<module>/<slug>`) and the old numbered addresses, which forward to the same lessons. `npm run content` adds new steps; commit it.
- `content/next.yaml`: the "Where to go next" page.
- `content/projects/NN-id.yaml`: a `seed` and `milestones`, each with the full `solution` at that point. Your code carries forward between milestones.
- `content/pro.yaml`: the Pro Track project list. Each project's lesson is `pro-track/starter/projects/<dir>/README.md`.
- `content/drills/interview-*.yaml`: interview prep (topic `interview`). Besides the drill types above, any drill file can use `choice` (a `prompt`, 2 to 4 `choices` and the number of the right `answer`; add `verify: output` to have the build check the right choice against the program's real output). Choices are shuffled when shown.
- `content/placement.yaml`: the placement quiz, one question per curriculum milestone, in curriculum order.
- `content/topics/*.yaml`: topic pages with `slug`, `title`, `description`, `modules`, an optional `visual`, a Markdown `body` and an `example` that must compile cleanly and run (`native: true` builds a thread example with `-pthread` instead).
- `content/visuals/*.yaml`: visualizations with `id`, `title`, `lang`, the `module` and `steps` they belong to, `summary`, `text` and `code` (kept short: at most 400 recorded lines).

Expected outputs are computed from the reference solutions by `npm run content`, so you never type them by hand. `python3 scripts/yaml-quote-fix.py content/*/*.yaml` quotes prose lines that contain colons.
