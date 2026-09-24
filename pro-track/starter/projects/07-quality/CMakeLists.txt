cmake_minimum_required(VERSION 3.20)
project(quality CXX)
include(../../cmake/arena.cmake)

add_library(store STATIC src/store.cpp)
target_include_directories(store PUBLIC src)

arena_test(store_test tests/store_test.cpp)
target_link_libraries(store_test PRIVATE store)
