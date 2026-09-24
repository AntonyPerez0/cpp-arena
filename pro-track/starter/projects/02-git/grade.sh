#!/usr/bin/env bash
# Grades project 02 by reading your repository's history.
HERE="$(cd "$(dirname "$0")" && pwd)"
source "$HERE/../../tools/lib.sh"
cd "$ARENA_ROOT" || exit 1
D=projects/02-git

in_repo() { git rev-parse --is-inside-work-tree >/dev/null 2>&1; }

intro_ok() {
  [ -f "$D/intro.md" ] || { echo "$D/intro.md is missing"; return 1; }
  local lines
  lines=$(grep -c '[^[:space:]]' "$D/intro.md")
  [ "$lines" -ge 3 ] || { echo "intro.md needs at least 3 non-empty lines (has $lines)"; return 1; }
}

feature_merges() {
  local n
  n=$(git log --merges --format=%s | grep -c 'feature/' || true)
  echo "merge commits from feature/ branches: $n"
  [ "$n" -ge 3 ]
}

roster_ok() {
  if grep -qE '^(<<<<<<<|=======|>>>>>>>)' "$D/roster.txt"; then
    echo "roster.txt still has conflict markers"
    return 1
  fi
  grep -q '^captain:' "$D/roster.txt" || { echo "roster.txt lost its captain line"; return 1; }
  if grep -q '^captain: *TBD' "$D/roster.txt"; then
    echo "the captain is still TBD"
    return 1
  fi
  local n
  n=$(git log --format=%H -- "$D/roster.txt" | wc -l)
  echo "commits that changed roster.txt: $n"
  [ "$n" -ge 3 ]
}

revert_ok() {
  git log --format=%s -- "$D" | grep -q '^Revert "' || { echo 'no commit made with git revert (subject starting with Revert ") touches this project'; return 1; }
}

tag_ok() {
  [ "$(git cat-file -t v0.1.0 2>/dev/null)" = "tag" ] || { echo "v0.1.0 must exist and be an annotated tag (git tag -a)"; return 1; }
}

messages_ok() {
  local bad=0 s
  while IFS= read -r s; do
    [ -z "$s" ] && continue
    case "$s" in Merge*|Revert*) continue ;; esac
    if [ ${#s} -gt 72 ]; then echo "too long (${#s} chars): $s"; bad=1; fi
    case "$s" in *.) echo "ends with a period: $s"; bad=1 ;; esac
    case "$s" in [a-z]*) echo "should start with a capital letter: $s"; bad=1 ;; esac
  done < <(git log --no-merges --format=%s -- "$D" | sed '$d')
  return $bad
}

check "this folder is a git repository" in_repo
check "intro.md was added" intro_ok
check "three feature/ branches were merged (pull requests or git merge)" feature_merges
check "the roster conflict was resolved" roster_ok
check "a bad commit was undone with git revert" revert_ok
check "release tag v0.1.0 is annotated" tag_ok
check "commit messages follow the conventions" messages_ok
finish
