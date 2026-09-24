cmake_minimum_required(VERSION 3.20)
project(libraries CXX)
include(../../cmake/arena.cmake)

# TODO: make the nlohmann_json library available (use the installed package when
# there is one, otherwise download it with FetchContent), then link the
# nlohmann_json::nlohmann_json target to the settings library below.
find_package(nlohmann_json 3.11 QUIET)
if(NOT nlohmann_json_FOUND)
  include(FetchContent)
  FetchContent_Declare(nlohmann_json
    GIT_REPOSITORY https://github.com/nlohmann/json.git
    GIT_TAG v3.11.3
    GIT_SHALLOW TRUE)
  set(JSON_BuildTests OFF CACHE INTERNAL "")
  FetchContent_MakeAvailable(nlohmann_json)
endif()

add_library(settings STATIC src/settings.cpp)
target_include_directories(settings PUBLIC src)
target_link_libraries(settings PRIVATE nlohmann_json::nlohmann_json)

arena_test(settings_test tests/settings_test.cpp)
target_link_libraries(settings_test PRIVATE settings)
