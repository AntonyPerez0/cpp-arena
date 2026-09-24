cmake_minimum_required(VERSION 3.20)
project(posix CXX)
include(../../cmake/arena.cmake)

find_package(Threads REQUIRED)

add_library(posix STATIC src/posix.cpp)
target_include_directories(posix PUBLIC src)
target_link_libraries(posix PUBLIC Threads::Threads)

arena_test(posix_test tests/posix_test.cpp)
target_link_libraries(posix_test PRIVATE posix)
