cmake_minimum_required(VERSION 3.20)
project(concurrency CXX)
include(../../cmake/arena.cmake)

find_package(Threads REQUIRED)

add_library(concurrency STATIC src/concurrency.cpp)
target_include_directories(concurrency PUBLIC src)
target_link_libraries(concurrency PUBLIC Threads::Threads)

arena_test(concurrency_test tests/concurrency_test.cpp)
target_link_libraries(concurrency_test PRIVATE concurrency)
