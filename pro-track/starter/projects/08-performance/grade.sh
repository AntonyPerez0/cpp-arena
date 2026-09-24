#!/usr/bin/env bash
# Grades project 08: correct results, and the 300,000-line log analyzed within
# 1.5 seconds in an optimized (Release) build.
HERE="$(cd "$(dirname "$0")" && pwd)"
source "$HERE/../../tools/lib.sh"
B="$HERE/build-grade"
rm -rf "$B" "$B-asan"
check "Release build (-O3, -Werror)" build "$HERE" "$B" -DCMAKE_BUILD_TYPE=Release
check "correct and within the time budget" ctest --test-dir "$B" --output-on-failure --timeout 60 -V -R LargeLog
check "all other tests pass" ctest --test-dir "$B" --output-on-failure --timeout 60 -E LargeLog
check "no memory errors (AddressSanitizer, small tests)" bash -c 'cmake -S "'"$HERE"'" -B "'"$B-asan"'" '"${ARENA_GENERATOR[*]}"' -DARENA_SANITIZE=address,undefined >/dev/null && cmake --build "'"$B-asan"'" >/dev/null && ctest --test-dir "'"$B-asan"'" --output-on-failure -E LargeLog'
finish
