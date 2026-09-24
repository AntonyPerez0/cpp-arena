cmake_minimum_required(VERSION 3.20)
project(exceptions CXX)
include(../../cmake/arena.cmake)

add_library(errors STATIC src/errors.cpp)
target_include_directories(errors PUBLIC src)

arena_test(errors_test tests/errors_test.cpp)
target_link_libraries(errors_test PRIVATE errors)
