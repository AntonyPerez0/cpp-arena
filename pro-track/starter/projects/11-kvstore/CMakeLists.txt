cmake_minimum_required(VERSION 3.20)
project(kvstore CXX)
include(../../cmake/arena.cmake)

find_package(Threads REQUIRED)

add_library(kv STATIC src/kv_store.cpp src/kv_server.cpp src/kv_client.cpp)
target_include_directories(kv PUBLIC src)
target_link_libraries(kv PUBLIC Threads::Threads)

add_executable(kvserver src/main.cpp)
target_link_libraries(kvserver PRIVATE kv)

arena_test(kv_test tests/kv_test.cpp)
target_link_libraries(kv_test PRIVATE kv)
