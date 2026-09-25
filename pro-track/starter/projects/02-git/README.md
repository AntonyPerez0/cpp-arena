# 02 · Git and the pull request workflow

Every professional team uses Git, and almost all of them work through **pull requests** (PRs): you change code on a branch, open a PR, teammates review it, automated checks run, and then it's merged. This project walks you through the whole loop, including the parts that scare beginners: merge conflicts and undoing mistakes.

There's no code to write here. The grader reads your repository's **history**.

**You'll practice:** commits and good commit messages, branches, pull requests, merging, resolving a conflict, `git revert`, and release tags.

## Background

### The mental model

- A **commit** is a snapshot of the whole project plus a message and a pointer to its parent commit(s).
- A **branch** is just a movable name pointing at a commit. `main` is the shared branch; you do your work on your own.
- **Merging** combines two branches' histories with a *merge commit* that has two parents.
- A **remote** (`origin`) is the copy on GitHub. `git push` sends commits there; `git pull` brings others' commits here.

```bash
git status                     # what changed?
git diff                       # exactly how?
git add path/to/file           # stage it for the next commit
git commit -m "Add the parser" # snapshot
git log --oneline --graph --all  # see the history as a graph
```

### Commit messages

Teams read history constantly (`git log`, `git blame`, release notes), so messages follow conventions:

- A short **subject line**, at most about 50 to 72 characters, in the **imperative** ("Add parser", not "Added parser"), starting with a capital letter, with **no trailing period**.
- If needed, a blank line and then a body explaining **why**, not what (the diff shows what).

### Undoing things safely

| Situation | Command |
|---|---|
| Unstage a file | `git restore --staged file` |
| Throw away uncommitted edits | `git restore file` |
| Undo a commit that's already pushed | `git revert <commit>`: makes a **new** commit that reverses it |
| Rewrite commits that are **not** pushed yet | `git commit --amend`, `git rebase -i` |

Never rewrite history other people already have (no `push --force` to shared branches). `revert` is the safe tool once something is public.

## Your tasks

Do these in order. Every step lists terminal commands; you can use the GitHub website for the PR parts.

1. **Set your identity** (once per machine):
   ```bash
   git config --global user.name "Your Name"
   git config --global user.email "you@example.com"
   ```
2. **A feature branch and a pull request.**
   ```bash
   git switch -c feature/intro
   # create projects/02-git/intro.md with at least 3 lines about you
   git add projects/02-git/intro.md
   git commit -m "Add an introduction"
   git push -u origin feature/intro
   ```
   On GitHub, open **Pull requests > New pull request**, pick `feature/intro`, create it, look at the checks, then **Merge pull request** (use *Create a merge commit*). Back in the terminal: `git switch main && git pull`.
3. **Make (and fix) a merge conflict.** Two teammates both edit the captain line in `roster.txt`:
   ```bash
   git switch -c feature/captain-a
   # change "captain: TBD" to a name, then:
   git commit -am "Name a captain"
   git push -u origin feature/captain-a
   git switch main
   git switch -c feature/captain-b
   # change "captain: TBD" to a DIFFERENT name, then:
   git commit -am "Name a different captain"
   git push -u origin feature/captain-b
   ```
   Open and merge a PR for `feature/captain-a`. Now open a PR for `feature/captain-b`: GitHub reports a **conflict**. Resolve it either with the **Resolve conflicts** button, or locally:
   ```bash
   git fetch origin        # your local main doesn't have captain-a's merge yet
   git switch feature/captain-b
   git merge origin/main   # CONFLICT in roster.txt
   # edit roster.txt: delete the <<<<<<< ======= >>>>>>> markers and keep a line
   # like "captain: karrigan", plus "vice-captain: ropz" if you like
   git add projects/02-git/roster.txt
   git commit              # finishes the merge
   git push
   ```
   Then merge the PR and `git switch main && git pull`.
4. **Undo a mistake with revert.** Commit a deliberately bad change to `intro.md` on main, push it, then undo it:
   ```bash
   git revert HEAD
   git push
   ```
5. **Tag a release.**
   ```bash
   git tag -a v0.1.0 -m "First release"
   git push origin v0.1.0
   ```
6. Check yourself: `bash tools/grade.sh 02-git` (from the repository root).

## Done when

- `intro.md` exists with at least 3 lines,
- at least three `feature/...` branches were merged,
- `roster.txt` has a real captain and no conflict markers,
- a `Revert "..."` commit touches this project,
- `v0.1.0` is an **annotated** tag,
- your commit subjects in this project are at most 72 characters, start with a capital letter and don't end with a period.

## Hints

- Lost? `git log --oneline --graph --all` shows exactly where every branch points.
- `git merge --abort` gets you out of a merge you want to restart.
- A tag made with plain `git tag v0.1.0` is *lightweight* and fails the check. Delete it (`git tag -d v0.1.0`, and `git push origin :refs/tags/v0.1.0` if pushed) and use `-a`.

## Stretch goals

- Try `git rebase main` on a branch instead of merging, and compare the resulting graph.
- Protect `main` on GitHub (**Settings > Branches**) so it can only change through pull requests with passing checks. That's how most companies configure it.
