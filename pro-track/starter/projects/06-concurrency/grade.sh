#!/usr/bin/env bash
# Grades project 06: tests pass, and pass again under ThreadSanitizer with no data races.
HERE="$(cd "$(dirname "$0")" && pwd)"
source "$HERE/../../tools/lib.sh"
B="$HERE/build-grade"
rm -rf "$B" "$B-tsan"
export TSAN_OPTIONS=halt_on_error=1:second_deadlock_stack=1
check "builds (-Werror)" build "$HERE" "$B"
check "tests pass" ctest --test-dir "$B" --output-on-failure --timeout 30
check "builds with ThreadSanitizer" build "$HERE" "$B-tsan" -DARENA_SANITIZE=thread
check "tests pass with no data races (run 3 times)" bash -c 'for i in 1 2 3; do ctest --test-dir "'"$B-tsan"'" --output-on-failure --timeout 60 || exit 1; done'
finish
