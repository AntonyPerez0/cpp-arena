# Pro Track (maintainers)

- `starter/` is exactly what learners get. The site's build packs it into
  `dist/pro/cpp-arena-pro.tar.gz` (`scripts/pack-pro.mjs`), and the Pro page
  gives learners a one-line command that downloads and pushes it.
- `solutions/<project>/` holds reference solutions: files copied over the
  starter project, or `simulate.sh` for projects graded from Git history.
- `check.sh` proves every grader works: the untouched starter must fail and
  the starter plus its solution must pass. CI runs it in
  `.github/workflows/pro-track.yml`; run it locally with `npm run check:pro`
  (needs the tools from `starter/tools/setup.sh`).
- Each project's lesson is its `README.md`; `content/pro.yaml` lists the
  projects and the site shows the READMEs on the Pro pages.
