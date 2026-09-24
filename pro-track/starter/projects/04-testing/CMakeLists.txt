cmake_minimum_required(VERSION 3.20)
project(testing CXX)
include(../../cmake/arena.cmake)

set(LEDGER_MUTANT 0 CACHE STRING "Which deliberately broken ledger to build (0 = correct)")

add_library(ledger STATIC src/ledger.cpp)
target_include_directories(ledger PUBLIC src)
target_compile_definitions(ledger PRIVATE LEDGER_MUTANT=${LEDGER_MUTANT})

arena_test(ledger_test tests/ledger_test.cpp)
target_link_libraries(ledger_test PRIVATE ledger)
