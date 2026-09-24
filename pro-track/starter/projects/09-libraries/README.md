# 09 · Using third-party libraries

Nobody writes a JSON parser, an HTTP client or a compression library from scratch at work. You pull in a well-tested library. C and C++ have no single built-in package manager, so knowing the options, and getting one into a CMake build cleanly, is a real professional skill.

In this project you add the popular **nlohmann/json** library to a project and use it to load and validate a server's settings.

**You'll practice:** `find_package`, `FetchContent`, imported targets, the package-manager landscape (vcpkg, Conan, system packages), and validating untrusted input.

## Background

### Four ways to get a library

| Approach | How | Good for |
|---|---|---|
| **System package** | `apt install nlohmann-json3-dev`, then `find_package(nlohmann_json)` | Linux servers and CI images you control |
| **FetchContent** | CMake downloads the source at configure time and builds it with your project | small libraries; no extra tools needed |
| **vcpkg** (Microsoft) | a `vcpkg.json` manifest lists dependencies; CMake finds them through vcpkg's toolchain file | cross-platform teams, many dependencies, Windows |
| **Conan** | a `conanfile.txt` plus `conan install` | large companies with binary caches |

Whichever one is used, the CMake side ends the same way: a **target** you link. The target carries its include directories, compile flags and dependencies with it:

```cmake
target_link_libraries(settings PRIVATE nlohmann_json::nlohmann_json)
```

The `::` in the name marks an *imported* target from a package. CMake gives a clear error if it doesn't exist, instead of silently producing `-lnlohmann_json`.

### find_package with a FetchContent fallback

```cmake
find_package(nlohmann_json 3.11 QUIET)          # installed? use it
if(NOT nlohmann_json_FOUND)
  include(FetchContent)                         # otherwise download it
  FetchContent_Declare(nlohmann_json
    GIT_REPOSITORY https://github.com/nlohmann/json.git
    GIT_TAG v3.11.3                             # ALWAYS pin an exact version
    GIT_SHALLOW TRUE)
  FetchContent_MakeAvailable(nlohmann_json)
endif()
```

**Pin versions.** "Latest" means your build can break tomorrow without anyone changing your code. Updating a dependency should be a deliberate commit.

### vcpkg in manifest mode (for reference)

```json
{ "dependencies": ["nlohmann-json", "fmt"] }
```

Save that as `vcpkg.json`, then configure with `-DCMAKE_TOOLCHAIN_FILE=<vcpkg>/scripts/buildsystems/vcpkg.cmake`. The same `find_package` calls then find vcpkg's copies. That's why writing `find_package` + targets is the portable habit: it works with every approach above.

### Choosing a library

Before adding a dependency, check: Is it maintained (recent releases, answered issues)? Is the **license** compatible with your product (MIT, BSD and Apache are usually fine; GPL often isn't for closed-source products)? How big is it, and what does it pull in? Most companies keep an approved list.

### nlohmann/json basics

```cpp
#include <nlohmann/json.hpp>
using nlohmann::json;

json j = json::parse(text, nullptr, false);   // false: return a "discarded" value instead of throwing
if (j.is_discarded()) { /* not valid JSON */ }
j.contains("port");  j["port"].is_number_integer();  int p = j["port"].get<int>();
json out = {{"name", "x"}, {"maps", std::vector<std::string>{"a", "b"}}};
std::string text = out.dump(2);               // pretty-printed with 2-space indent
```

## Your tasks

1. In `CMakeLists.txt`, make `nlohmann_json` available (system package first, FetchContent as a fallback) and link it to the `settings` library.
2. Implement `load_settings` and `to_json` in `src/settings.cpp`. `src/settings.h` lists every rule and error message.
3. Treat the JSON as untrusted input: check every field's presence, type and range before using it.
4. Grade (`bash ../../tools/grade.sh 09-libraries`). The grader also builds with the package hidden, to prove your FetchContent fallback works. Then commit and push.

## Done when

- the build works with the installed package **and** with the download,
- all tests pass.

## Hints

- `json::parse` with `allow_exceptions = false` never throws; check `is_discarded()` and `is_object()`.
- Write small helpers like `require(j, "port")` and `require_int(j, "port")` so each rule is one line.
- `j["key"]` on a *const* json that lacks the key is undefined behavior. Use `find`/`contains` first.

## Stretch goals

- Add `fmt` (via `find_package(fmt)` / FetchContent) and compare it with C++20 `std::format`.
- Convert the project to a vcpkg manifest (`vcpkg.json`) and build it with the vcpkg toolchain file.
