cmake_minimum_required(VERSION 3.20)
project(strmap VERSION 1.0 LANGUAGES C CXX)
include(../../cmake/arena.cmake)

add_library(strmap STATIC src/strmap.c)
target_include_directories(strmap PUBLIC include)

add_executable(example examples/example.c)
target_link_libraries(example PRIVATE strmap)

arena_test(strmap_test tests/strmap_test.cpp)
target_link_libraries(strmap_test PRIVATE strmap)
