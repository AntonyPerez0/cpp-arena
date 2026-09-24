#!/usr/bin/env bash
# Prints which Pro Track tools are available.
ok=0
for t in gcc g++ clang clang++ cmake ninja gdb valgrind clang-tidy clang-format git; do
  if command -v "$t" >/dev/null 2>&1; then
    printf '  ok       %-13s %s\n' "$t" "$("$t" --version 2>&1 | head -n 1)"
  else
    printf '  MISSING  %s\n' "$t"
    ok=1
  fi
done
if [ -f /usr/include/gtest/gtest.h ]; then echo "  ok       googletest (system)"; else echo "  note     googletest will be downloaded by CMake on first build"; fi
if [ $ok -ne 0 ]; then echo; echo "Run: bash tools/setup.sh"; fi
exit $ok
