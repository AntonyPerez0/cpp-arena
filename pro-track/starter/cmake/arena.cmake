# Shared settings for every Pro Track project.
# Each project's CMakeLists.txt includes this right after project().

set(CMAKE_C_STANDARD 17)
set(CMAKE_C_STANDARD_REQUIRED ON)
set(CMAKE_CXX_STANDARD 20)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_CXX_EXTENSIONS OFF)
set(CMAKE_EXPORT_COMPILE_COMMANDS ON)   # lets clangd and clang-tidy see your flags

if(NOT CMAKE_BUILD_TYPE AND NOT CMAKE_CONFIGURATION_TYPES)
  set(CMAKE_BUILD_TYPE Debug CACHE STRING "Build type" FORCE)
endif()

option(ARENA_WERROR "Treat compiler warnings as errors" ON)
set(ARENA_SANITIZE "" CACHE STRING "Sanitizers to enable, for example address,undefined or thread")

enable_testing()

# GoogleTest: use the system package if it is installed (tools/setup.sh installs it),
# otherwise download it once. This happens before the warning flags below so that
# a downloaded GoogleTest is not compiled with -Werror.
find_package(GTest QUIET)
if(NOT GTest_FOUND)
  include(FetchContent)
  FetchContent_Declare(googletest
    GIT_REPOSITORY https://github.com/google/googletest.git
    GIT_TAG v1.15.2
    GIT_SHALLOW TRUE)
  set(INSTALL_GTEST OFF CACHE BOOL "" FORCE)
  set(gtest_force_shared_crt ON CACHE BOOL "" FORCE)
  FetchContent_MakeAvailable(googletest)
endif()
include(GoogleTest)

add_compile_options(-Wall -Wextra -Wpedantic)
if(ARENA_WERROR)
  add_compile_options(-Werror)
endif()

if(ARENA_SANITIZE)
  add_compile_options(-fsanitize=${ARENA_SANITIZE} -fno-omit-frame-pointer -fno-sanitize-recover=all)
  add_link_options(-fsanitize=${ARENA_SANITIZE})
endif()

# arena_test(<name> <sources...>): a GoogleTest executable registered with CTest.
function(arena_test name)
  add_executable(${name} ${ARGN})
  target_link_libraries(${name} PRIVATE GTest::gtest_main)
  gtest_discover_tests(${name} DISCOVERY_TIMEOUT 60)
endfunction()
