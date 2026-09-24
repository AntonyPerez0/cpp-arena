#!/usr/bin/env bash
# Grades project 01: builds with warnings as errors, runs the unit tests,
# and checks the wordfreq program's output.
HERE="$(cd "$(dirname "$0")" && pwd)"
source "$HERE/../../tools/lib.sh"
B="$HERE/build-grade"
rm -rf "$B"

check "CMake configures and everything builds (-Werror)" build "$HERE" "$B"
check "unit tests pass" run_tests "$B"
check "wordfreq exists and prints the top 3 words" bash -c '
  out="$("'"$B"'/wordfreq" "'"$HERE"'/tests/sample.txt")" || exit 1
  expected=$(printf "b 3\nrush 3\nno 2")
  echo "$out"
  [ "$out" = "$expected" ] || { echo "expected:"; echo "$expected"; exit 1; }'
check "wordfreq rejects a missing argument with exit code 2" bash -c '"'"$B"'/wordfreq"; [ $? -eq 2 ]'
finish
