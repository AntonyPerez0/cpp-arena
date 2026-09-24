#!/usr/bin/env bash
# Grades capstone 12 like a library release: tests, AddressSanitizer, Valgrind,
# a strict C99/C++ header, only public symbols exported, and documentation.
HERE="$(cd "$(dirname "$0")" && pwd)"
source "$HERE/../../tools/lib.sh"
B="$HERE/build-grade"
rm -rf "$B" "$B-asan"

header_c99() {
  echo '#include "strmap.h"' | gcc -std=c99 -pedantic -Wall -Wextra -Werror -fsyntax-only -I"$HERE/include" -x c -
}
header_cpp() {
  echo '#include "strmap.h"' | g++ -std=c++17 -pedantic -Wall -Wextra -Werror -fsyntax-only -I"$HERE/include" -x c++ -
}
only_public_symbols() {
  local bad
  bad=$(nm --defined-only -g "$B/libstrmap.a" | awk 'NF==3 && $2 ~ /[A-Z]/ {print $3}' | grep -v '^strmap_' || true)
  if [ -n "$bad" ]; then
    echo "These symbols are exported but aren't part of the API (make them static):"
    echo "$bad"
    return 1
  fi
}
valgrind_clean() {
  valgrind --error-exitcode=1 --leak-check=full --errors-for-leak-kinds=all -q "$B/strmap_test" >/dev/null
}
readme_ok() {
  [ -f "$HERE/API.md" ] && [ "$(wc -w <"$HERE/API.md")" -ge 150 ] || { echo "Write API.md (at least 150 words): ownership, errors, thread safety, versioning"; return 1; }
}

check "builds (-Werror)" build "$HERE" "$B"
check "tests pass" run_tests "$B"
check "the example program runs" "$B/example"
check "header compiles as strict C99" header_c99
check "header compiles as C++" header_cpp
check "the library exports only strmap_* symbols" only_public_symbols
check "Valgrind: no leaks or memory errors" valgrind_clean
check "builds with AddressSanitizer" build "$HERE" "$B-asan" -DARENA_SANITIZE=address,undefined
check "tests pass under AddressSanitizer" run_tests "$B-asan"
check "API.md documents the library" readme_ok
finish
