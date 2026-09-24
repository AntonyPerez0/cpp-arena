#!/usr/bin/env bash
# Grades project 07: clean clang-tidy, clean clang-format, tests pass, no leaks.
HERE="$(cd "$(dirname "$0")" && pwd)"
source "$HERE/../../tools/lib.sh"
B="$HERE/build-grade"
rm -rf "$B" "$B-asan"
export ASAN_OPTIONS=detect_leaks=1

check "builds (-Werror)" build "$HERE" "$B"
check "tests pass" run_tests "$B"
check "clang-tidy reports nothing (see .clang-tidy)" bash -c 'cd "'"$HERE"'" && clang-tidy --quiet -p "'"$B"'" src/*.cpp'
check "clang-format finds nothing to change" bash -c 'cd "'"$HERE"'" && clang-format --dry-run --Werror src/*.h src/*.cpp tests/*.cpp'
check "builds with AddressSanitizer" build "$HERE" "$B-asan" -DARENA_SANITIZE=address,undefined
check "tests pass with no leaks" run_tests "$B-asan"
finish
