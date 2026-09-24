cmake_minimum_required(VERSION 3.20)
project(toolchain C CXX)
include(../../cmake/arena.cmake)

# TODO 1: add a STATIC library target named strutil, built from src/strutil.c.
#         Anything that links strutil must be able to #include "strutil.h",
#         so give it the include/ directory as a PUBLIC include directory.
add_library(strutil STATIC src/strutil.c)
target_include_directories(strutil PUBLIC include)

# TODO 2: add an executable named wordfreq, built from src/wordfreq.c,
#         that links the strutil library.
add_executable(wordfreq src/wordfreq.c)
target_link_libraries(wordfreq PRIVATE strutil)

# The tests are already set up. They only work once TODO 1 exists.
arena_test(strutil_test tests/strutil_test.cpp)
target_link_libraries(strutil_test PRIVATE strutil)
