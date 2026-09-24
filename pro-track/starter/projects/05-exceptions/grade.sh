#!/usr/bin/env bash
# Grades project 05: all tests pass, also under AddressSanitizer (no leaks on error paths).
HERE="$(cd "$(dirname "$0")" && pwd)"
source "$HERE/../../tools/lib.sh"
B="$HERE/build-grade"
rm -rf "$B" "$B-asan"
check "builds (-Werror)" build "$HERE" "$B"
check "tests pass" run_tests "$B"
check "builds with AddressSanitizer" build "$HERE" "$B-asan" -DARENA_SANITIZE=address,undefined
check "tests pass with no leaks or memory errors" run_tests "$B-asan"
finish
