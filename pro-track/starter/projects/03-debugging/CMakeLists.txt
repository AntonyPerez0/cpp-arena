cmake_minimum_required(VERSION 3.20)
project(debugging CXX)
include(../../cmake/arena.cmake)

add_library(scoreboard STATIC src/scoreboard.cpp)
target_include_directories(scoreboard PUBLIC src)

add_executable(demo src/demo.cpp)
target_link_libraries(demo PRIVATE scoreboard)

arena_test(scoreboard_test tests/scoreboard_test.cpp)
target_link_libraries(scoreboard_test PRIVATE scoreboard)
