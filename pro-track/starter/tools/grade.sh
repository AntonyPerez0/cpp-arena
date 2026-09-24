#!/usr/bin/env bash
# Grades one project (or all of them) exactly like GitHub Actions does.
#   bash tools/grade.sh 01-toolchain
#   bash tools/grade.sh all
set -uo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT" || exit 2

if [ $# -ne 1 ]; then
  echo "usage: bash tools/grade.sh <project>|all"
  echo "projects:"
  ls projects
  exit 2
fi

if [ "$1" = "all" ]; then
  set -- $(ls projects)
fi

summary=""
status=0
for p in "$@"; do
  p="${p%/}"
  p="${p#projects/}"
  if [ ! -f "projects/$p/grade.sh" ]; then
    echo "No such project: $p"
    status=2
    continue
  fi
  echo "=============================================="
  echo " Grading $p"
  echo "=============================================="
  if bash "projects/$p/grade.sh"; then
    summary+="| $p | :white_check_mark: passed |"$'\n'
  else
    summary+="| $p | :x: not yet |"$'\n'
    status=1
  fi
done

if [ -n "${GITHUB_STEP_SUMMARY:-}" ]; then
  {
    echo "| Project | Result |"
    echo "|---|---|"
    printf '%s' "$summary"
  } >>"$GITHUB_STEP_SUMMARY"
fi
echo
printf '%s' "$summary" | sed 's/:white_check_mark:/OK /; s/:x:/-- /'
exit $status
