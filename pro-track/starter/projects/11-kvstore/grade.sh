#!/usr/bin/env bash
# Grades capstone 11: tests pass normally, under AddressSanitizer, and under
# ThreadSanitizer (three runs), and DESIGN.md explains your design.
HERE="$(cd "$(dirname "$0")" && pwd)"
source "$HERE/../../tools/lib.sh"
B="$HERE/build-grade"
rm -rf "$B" "$B-asan" "$B-tsan"
export TSAN_OPTIONS=halt_on_error=1
check "builds (-Werror)" build "$HERE" "$B"
check "tests pass" ctest --test-dir "$B" --output-on-failure --timeout 30
check "builds with AddressSanitizer" build "$HERE" "$B-asan" -DARENA_SANITIZE=address,undefined
check "tests pass under AddressSanitizer" ctest --test-dir "$B-asan" --output-on-failure --timeout 60
check "builds with ThreadSanitizer" build "$HERE" "$B-tsan" -DARENA_SANITIZE=thread
check "no data races (3 runs)" bash -c 'for i in 1 2 3; do ctest --test-dir "'"$B-tsan"'" --output-on-failure --timeout 90 || exit 1; done'
check "DESIGN.md explains the design (at least 150 words)" bash -c '[ -f "'"$HERE"'/DESIGN.md" ] && [ "$(wc -w < "'"$HERE"'/DESIGN.md")" -ge 150 ] || { echo "Write DESIGN.md: threading model, locking, durability, and what you would do next"; exit 1; }'
finish
