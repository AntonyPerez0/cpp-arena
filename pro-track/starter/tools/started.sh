#!/usr/bin/env bash
# Prints a JSON list of projects you have started (changed since the starter was imported).
# GitHub Actions uses it so only those projects are graded. Pass "all" to list every project.
cd "$(dirname "$0")/.." || exit 1
first=""
out="["
for d in projects/*/; do
  p="$(basename "$d")"
  commits=$(git rev-list --count HEAD -- "projects/$p" 2>/dev/null || echo 0)
  if [ "${1:-}" = "all" ] || [ "$commits" -gt 1 ]; then
    out+="${first}\"$p\""
    first=","
  fi
done
echo "$out]"
