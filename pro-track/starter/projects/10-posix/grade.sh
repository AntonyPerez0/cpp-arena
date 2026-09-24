#!/usr/bin/env bash
# Grades project 10: tests pass normally and under AddressSanitizer
# (which also catches leaked file descriptors' buffers and memory errors).
HERE="$(cd "$(dirname "$0")" && pwd)"
source "$HERE/../../tools/lib.sh"
B="$HERE/build-grade"
rm -rf "$B" "$B-asan"
check "builds (-Werror)" build "$HERE" "$B"
check "tests pass" ctest --test-dir "$B" --output-on-failure --timeout 30
check "builds with AddressSanitizer" build "$HERE" "$B-asan" -DARENA_SANITIZE=address,undefined
check "tests pass under AddressSanitizer" ctest --test-dir "$B-asan" --output-on-failure --timeout 30
finish
