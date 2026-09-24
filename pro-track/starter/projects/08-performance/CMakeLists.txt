cmake_minimum_required(VERSION 3.20)
project(performance CXX)
include(../../cmake/arena.cmake)

add_library(analyze STATIC src/analyze.cpp)
target_include_directories(analyze PUBLIC src)

add_executable(bench src/bench.cpp)
target_link_libraries(bench PRIVATE analyze)

arena_test(analyze_test tests/analyze_test.cpp)
target_link_libraries(analyze_test PRIVATE analyze)
