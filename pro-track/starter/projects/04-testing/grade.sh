#!/usr/bin/env bash
# Grades project 04 with mutation testing: your tests must pass on the real
# ledger and FAIL on each of 7 deliberately broken versions ("mutants").
HERE="$(cd "$(dirname "$0")" && pwd)"
source "$HERE/../../tools/lib.sh"
B="$HERE/build-grade"
rm -rf "$B" "$B"-m*

untouched() {
  local h
  h=$(cat "$HERE/src/ledger.cpp" "$HERE/src/ledger.h" | sha256sum | cut -d" " -f1)
  [ "$h" = "521e81ef10fe8c1a24fd855cc9d5a72cce9052979691a3251e89fb0b9ed2206e" ] || { echo "src/ledger.cpp or src/ledger.h was changed. Restore them: git checkout -- projects/04-testing/src"; return 1; }
}

enough_tests() {
  local n
  n=$(ctest --test-dir "$B" -N | sed -n 's/^Total Tests: //p')
  echo "tests found: $n"
  [ "${n:-0}" -ge 10 ] || { echo "write at least 10 TEST cases"; return 1; }
}

mutant_killed() {
  local k="$1"
  build "$HERE" "$B-m$k" -DLEDGER_MUTANT="$k" >/dev/null || { echo "mutant $k did not build"; return 1; }
  if ctest --test-dir "$B-m$k" --timeout 60 >/dev/null 2>&1; then
    echo "every test still PASSES against this broken ledger, so no test covers the rule."
    return 1
  fi
  echo "killed: at least one test failed"
}

check "the ledger source is unchanged" untouched
check "builds (-Werror)" build "$HERE" "$B"
check "all your tests pass on the real ledger" run_tests "$B"
check "at least 10 tests" enough_tests
check "mutant 1 killed (deposit accepts 0)" mutant_killed 1
check "mutant 2 killed (can't withdraw the entire balance)" mutant_killed 2
check "mutant 3 killed (withdraw accepts negative amounts)" mutant_killed 3
check "mutant 4 killed (interest rounds up)" mutant_killed 4
check "mutant 5 killed (interest isn't counted as a transaction)" mutant_killed 5
check "mutant 6 killed (history is oldest first)" mutant_killed 6
check "mutant 7 killed (negative interest accepted)" mutant_killed 7
finish
