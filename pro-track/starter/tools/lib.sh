# Helpers shared by every projects/*/grade.sh. Source it, don't run it.
# shellcheck shell=bash

ARENA_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ARENA_FAILED=0
ARENA_GENERATOR=()
if command -v ninja >/dev/null 2>&1; then ARENA_GENERATOR=(-G Ninja); fi

# check "description" command [args...]: runs a check and records the result.
check() {
  local what="$1"
  shift
  echo
  echo "::group::$what"
  if "$@"; then
    echo "::endgroup::"
    echo "PASS  $what"
  else
    echo "::endgroup::"
    echo "FAIL  $what"
    ARENA_FAILED=1
  fi
}

# build <source dir> <build dir> [extra cmake args...]
build() {
  local src="$1" out="$2"
  shift 2
  cmake -S "$src" -B "$out" "${ARENA_GENERATOR[@]}" "$@" && cmake --build "$out" -j "$(nproc 2>/dev/null || echo 2)"
}

# run_tests <build dir>: runs every CTest test and shows output for failures.
run_tests() {
  ctest --test-dir "$1" --output-on-failure --timeout 120
}

# finish: exit with the overall result. Call it last in grade.sh.
finish() {
  echo
  if [ "$ARENA_FAILED" -eq 0 ]; then
    echo "RESULT: PASSED"
  else
    echo "RESULT: NOT YET. Scroll up to the first FAIL line for details."
  fi
  exit "$ARENA_FAILED"
}
