# C/C++ Arena · Pro Track

This repository is your workspace for the **Pro Track**: twelve projects that take you from "I know C and C++" to "I can work in a professional C/C++ codebase". You build real software with real tools: compilers and CMake, Git and pull requests, debuggers and sanitizers, unit tests, linters, profilers, third-party libraries, POSIX system calls, and two capstone projects.

Every project is graded automatically by **GitHub Actions** each time you push, exactly like a team's CI.

## Getting started

1. Use **GitHub Codespaces** (a full Linux development environment in your browser) or any Linux or macOS machine.
   - Codespaces: on this repository's page, **Code > Codespaces > Create codespace on main**. The tools install themselves (it takes a few minutes the first time).
   - Your own machine (Ubuntu/Debian): `bash tools/setup.sh`
2. Check your tools: `bash tools/doctor.sh`
3. Open `projects/01-toolchain/README.md` and start.

## The projects

| # | Project | You'll learn |
|---|---|---|
| 01 | [Compilers, linking and CMake](projects/01-toolchain/README.md) | build stages, object files, static libraries, CMake targets |
| 02 | [Git and pull requests](projects/02-git/README.md) | branches, PRs, merge conflicts, revert, tags |
| 03 | [Debugging](projects/03-debugging/README.md) | gdb, AddressSanitizer, UndefinedBehaviorSanitizer |
| 04 | [Unit testing](projects/04-testing/README.md) | GoogleTest, edge cases, mutation testing |
| 05 | [Exceptions](projects/05-exceptions/README.md) | custom exceptions, strong guarantee, error boundaries |
| 06 | [Concurrency](projects/06-concurrency/README.md) | threads, mutexes, condition variables, ThreadSanitizer |
| 07 | [Code quality](projects/07-quality/README.md) | clang-tidy, clang-format, the Core Guidelines |
| 08 | [Performance](projects/08-performance/README.md) | Release builds, profiling, complexity in real code |
| 09 | [Third-party libraries](projects/09-libraries/README.md) | find_package, FetchContent, vcpkg, JSON |
| 10 | [POSIX systems programming](projects/10-posix/README.md) | file descriptors, fork/exec, pipes, sockets |
| 11 | [Capstone A: key-value server](projects/11-kvstore/README.md) | a multi-threaded networked database |
| 12 | [Capstone B: a C library](projects/12-clib/README.md) | API design, out-of-memory safety, Valgrind |

Do them in order: later projects assume earlier skills.

## How grading works

- Grade one project locally, exactly as CI does: `bash tools/grade.sh 03-debugging`
- On every push, the **Grade** workflow grades each project you've changed since importing the starter. Open the **Actions** tab: each project gets its own green or red check, and the log shows which step failed.
- To grade every project: **Actions > Grade > Run workflow**, with "all" ticked.

Keep your repository **public** if you can. GitHub Actions minutes are free and unlimited for public repositories, and a public repo doubles as a portfolio for job applications.

## Layout

```
cmake/arena.cmake     shared compiler settings, sanitizers and GoogleTest
tools/                setup, doctor and grading scripts
projects/NN-name/     one folder per project: README.md, code, tests, grade.sh
.github/workflows/    the grading workflow
```
