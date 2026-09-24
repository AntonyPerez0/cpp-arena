#!/usr/bin/env bash
# Maintainer check for the Pro Track (runs in this repo's CI):
# for every project, the untouched starter must NOT pass its grader, and the
# starter with the reference solution copied over it MUST pass.
#   bash pro-track/check.sh            # all projects
#   bash pro-track/check.sh 03-debugging
set -uo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
projects=("$@")
if [ ${#projects[@]} -eq 0 ]; then
  mapfile -t projects < <(ls "$HERE/starter/projects")
fi
fail=0
for p in "${projects[@]}"; do
  work="$(mktemp -d)"
  cp -r "$HERE/starter/." "$work/"
  # 1. starter alone must fail
  if [ -x "$HERE/solutions/$p/simulate-starter.sh" ]; then
    (cd "$work" && bash "$HERE/solutions/$p/simulate-starter.sh") >/dev/null 2>&1
  fi
  if (cd "$work" && bash tools/grade.sh "$p") >"$work/starter.log" 2>&1; then
    echo "FAIL $p: the untouched starter already passes"
    fail=1
  else
    echo "ok   $p: starter does not pass yet"
  fi
  rm -rf "$work"
  # 2. starter + solution must pass
  work="$(mktemp -d)"
  cp -r "$HERE/starter/." "$work/"
  if [ -x "$HERE/solutions/$p/simulate.sh" ]; then
    (cd "$work" && bash "$HERE/solutions/$p/simulate.sh")
  else
    cp -r "$HERE/solutions/$p/." "$work/projects/$p/"
  fi
  if (cd "$work" && bash tools/grade.sh "$p") >"$work/solution.log" 2>&1; then
    echo "ok   $p: reference solution passes"
  else
    echo "FAIL $p: reference solution does not pass. Log:"
    tail -n 60 "$work/solution.log"
    fail=1
  fi
  rm -rf "$work"
done
exit $fail
