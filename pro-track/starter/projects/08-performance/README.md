# 08 · Profiling and performance

`analyze()` in `src/analyze.cpp` produces the right answers, and on a 20-line test it's instant. On a real 300,000-line log it would run for hours. This is the most common performance story in industry: code that was fine at small scale meets production data.

Your job: **measure** where the time goes, fix the biggest problems, and get the large test under **1.5 seconds** in a Release build, without changing any result.

**You'll practice:** Release vs. Debug builds, benchmarking, profilers (callgrind, gprof, perf), algorithmic complexity in real code, avoiding copies and allocations, and choosing containers.

## Background

### Rule 1: measure, don't guess

Programmers are famously bad at guessing where time goes. Always measure first, and measure a **Release** build (`-O2`/`-O3`). A Debug build can be ten times slower and point at the wrong culprit.

```bash
cmake -S . -B build-rel -G Ninja -DCMAKE_BUILD_TYPE=Release
cmake --build build-rel
./build-rel/bench 5000       # start small: the original code is very slow
./build-rel/bench 20000
```

Try doubling the input: if the time roughly **quadruples**, something is O(n²).

### Profilers

A profiler tells you which functions (and lines) the time is spent in.

| Tool | How | Notes |
|---|---|---|
| **callgrind** | `valgrind --tool=callgrind ./build-rel/bench 3000` then `callgrind_annotate callgrind.out.*` | works everywhere, including Codespaces; slow but precise |
| **gprof** | build with `-pg`, run, then `gprof ./bench gmon.out` | old but simple |
| **perf** | `perf record -g ./bench` then `perf report` | the standard on Linux servers; may not be allowed inside containers |

Look at **inclusive** cost (a function plus everything it calls) to find the expensive subtree, then **self** cost to find the hot spot inside it.

### The usual suspects

| Smell | Fix |
|---|---|
| `std::find` on a vector inside a loop (O(n) per lookup) | `std::unordered_map` / `std::unordered_set` (O(1) average) |
| sorting inside a loop | sort once at the end, or use `std::nth_element` when you need one position |
| copying strings per line (`std::string line = lines[i]`, `std::stringstream`) | `std::string_view` into data that outlives it; parse by hand or with `std::from_chars` |
| repeated growth of vectors | `reserve()` when you know the size |
| a lookup you just did, done again | remember the result |

Big-O first: a 10× faster constant factor never saves an O(n²) algorithm on a million items.

## Your tasks

1. Build in Release, run `bench` at a few sizes and estimate the complexity.
2. Profile with callgrind on a small input and find the hot spots.
3. Rewrite `analyze()`, keeping the exact behavior described in `src/analyze.h`. The small tests pin down the tricky rules (ties, malformed lines, percentile rank), so run them often.
4. Grade (`bash ../../tools/grade.sh 08-performance`), then commit and push.

## Done when

- all tests pass, including the 300,000-line test within 1500 ms in Release,
- the small tests also pass under AddressSanitizer.

## Hints

- There are at least four separate problems. Fixing only one won't be enough, and profiling will show you the next one.
- `std::unordered_map<std::string_view, int>` is safe here: the views point into `lines`, which lives until `analyze` returns. Convert to `std::string` only for the final `Report`.
- The 95th percentile only needs one element in the right place: `std::nth_element` is O(n); a full sort is O(n log n); sorting after **every** line is O(n² log n).
- For ties, compare names only when counts or averages are equal, exactly like the original.

## Stretch goals

- Get 1,000,000 lines under 300 ms.
- Compare `std::unordered_map` with `std::map` for the users, and explain the difference you measure.
- Use Google Benchmark (`benchmark::State`) to write a proper micro-benchmark for your parser.
