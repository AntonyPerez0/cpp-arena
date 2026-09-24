#!/usr/bin/env bash
# Grades project 09: the project must build both with the system package and
# with the library downloaded by FetchContent, and the tests must pass.
HERE="$(cd "$(dirname "$0")" && pwd)"
source "$HERE/../../tools/lib.sh"
B="$HERE/build-grade"
rm -rf "$B" "$B-fetch"
check "CMake links nlohmann_json::nlohmann_json" grep -q "nlohmann_json::nlohmann_json" "$HERE/CMakeLists.txt"
check "builds (-Werror)" build "$HERE" "$B"
check "tests pass" run_tests "$B"
check "also builds when the package isn't installed (FetchContent fallback)" build "$HERE" "$B-fetch" -DCMAKE_DISABLE_FIND_PACKAGE_nlohmann_json=ON
check "tests pass with the downloaded library" run_tests "$B-fetch"
finish
