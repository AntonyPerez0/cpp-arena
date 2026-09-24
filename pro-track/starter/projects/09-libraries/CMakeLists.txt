cmake_minimum_required(VERSION 3.20)
project(libraries CXX)
include(../../cmake/arena.cmake)

# TODO: make the nlohmann_json library available (use the installed package when
# there is one, otherwise download it with FetchContent), then link the
# nlohmann_json::nlohmann_json target to the settings library below.

add_library(settings STATIC src/settings.cpp)
target_include_directories(settings PUBLIC src)

arena_test(settings_test tests/settings_test.cpp)
target_link_libraries(settings_test PRIVATE settings)
