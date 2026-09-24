#!/usr/bin/env bash
# Grades project 03: the tests must pass under AddressSanitizer and UndefinedBehaviorSanitizer,
# and FINDINGS.md must document what you found.
HERE="$(cd "$(dirname "$0")" && pwd)"
source "$HERE/../../tools/lib.sh"
B="$HERE/build-grade"
rm -rf "$B"
export ASAN_OPTIONS=detect_leaks=1:abort_on_error=1
export UBSAN_OPTIONS=print_stacktrace=1:halt_on_error=1

check "builds with -fsanitize=address,undefined" build "$HERE" "$B" -DARENA_SANITIZE=address,undefined
check "tests pass with no sanitizer reports" run_tests "$B"
check "the demo program runs cleanly under the sanitizers" "$B/demo"
check "FINDINGS.md documents at least four bugs" bash -c '[ "$(grep -c "^- " "'"$HERE"'/FINDINGS.md")" -ge 4 ] || { echo "Add one \"- \" bullet per bug to FINDINGS.md"; exit 1; }'
finish
