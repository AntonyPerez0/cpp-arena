# 03 · Debugging with gdb and sanitizers

Real bugs rarely announce themselves. A program crashes on one customer's machine, or silently corrupts memory and fails three functions later. Professionals don't guess: they use a **debugger** to inspect a running program, and **sanitizers** that make memory and undefined-behavior bugs fail loudly, right where they happen.

`src/scoreboard.cpp` contains **four** real bugs of the kinds that cause production incidents: a null pointer dereference, a use-after-free, a buffer overflow and a signed integer overflow. Some tests even pass without the right tools. Find all four, fix them, and write down what you found.

**You'll practice:** gdb, AddressSanitizer, UndefinedBehaviorSanitizer, reading stack traces, and documenting a fix.

## Background

### gdb: stop the program and look around

Build with debug info (`-g`, which the Debug build type already uses), then:

```bash
cmake -S . -B build -G Ninja && cmake --build build
gdb ./build/demo
```

| gdb command | What it does |
|---|---|
| `run` | start the program (add arguments after it) |
| `bt` | **backtrace**: the chain of function calls when it stopped or crashed |
| `frame 2` | jump to a frame from the backtrace |
| `print killer`, `p *v`, `p players_.size()` | show values |
| `break scoreboard.cpp:30`, `break Scoreboard::top` | stop at a line or function |
| `next` / `step` / `finish` / `continue` | step over, step into, run to the end of the function, keep going |
| `watch k.kills` | stop whenever a value changes |
| `info locals` | all local variables |

The first thing to do with any crash is `run`, then `bt`. The top frames that are in **your** code tell you where to look.

### Sanitizers: make hidden bugs crash immediately

Sanitizers are compiler instrumentation. You rebuild with a flag, and the program checks itself as it runs:

| Sanitizer | Flag | Catches |
|---|---|---|
| AddressSanitizer (ASan) | `-fsanitize=address` | out-of-bounds, use-after-free, double free, leaks |
| UndefinedBehaviorSanitizer (UBSan) | `-fsanitize=undefined` | signed overflow, bad shifts, null member access, misaligned pointers |
| ThreadSanitizer (TSan) | `-fsanitize=thread` | data races (project 06) |

The shared CMake setup turns them on with one option:

```bash
cmake -S . -B build-asan -G Ninja -DARENA_SANITIZE=address,undefined
cmake --build build-asan
ctest --test-dir build-asan --output-on-failure
```

An ASan report looks scary but reads top to bottom: the **kind** of error (`heap-use-after-free`), the stack where the bad access happened, then where that memory was allocated and where it was freed. Look for the first frame in `scoreboard.cpp`.

Valgrind finds many of the same memory errors without recompiling (`valgrind ./build/demo`), just much more slowly.

## Your tasks

1. Build normally and run `./build/demo`. It crashes. Use `gdb ./build/demo`, then `run` and `bt`, to find the line. Fix the first bug.
2. Build with `-DARENA_SANITIZE=address,undefined` and run the tests. Each sanitizer report points at another bug. Fix them one at a time, rerunning after each fix.
3. For every bug, add a bullet to `FINDINGS.md`: what reported it, where it was, and how you fixed it.
4. Grade it: `bash ../../tools/grade.sh 03-debugging`, then commit and push.

## Done when

- all tests pass with ASan and UBSan enabled, with no reports,
- `demo` runs cleanly under the sanitizers,
- `FINDINGS.md` has at least four `- ` bullets.

## Hints

- `record_kill` keeps a **reference** into `players_` and then calls `add()`, which may `push_back`. What happens to references into a vector when it grows?
- `find_mut` returns `nullptr` for unknown names. The spec says unknown killers are ignored.
- Look at the loop bound in `top`, and think about what happens when `n` is 0 or negative.
- `p->kills * 1000000` is computed in `int` **before** it's converted to `long long`.

## Stretch goals

- Run `valgrind --leak-check=full ./build/demo` on the fixed build and read the summary.
- Break something on purpose (for example, return a reference to a local) and see which tool catches it and how.
