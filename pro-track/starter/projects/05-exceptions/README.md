# 05 · Exceptions and exception safety

The Arena site compiles with exceptions turned off (WebAssembly limits), so the lessons taught error codes and `std::optional`. Most enterprise C++ code **does** use exceptions, so here you learn them properly: throwing and catching, designing error types, and the part that separates professionals from beginners, **exception safety**.

**You'll practice:** custom exception classes, `throw`/`try`/`catch`, rethrowing, the basic and strong guarantees, copy-and-swap, and handling errors at a program's boundary.

## Background

### Throwing and catching

```cpp
int parse_port(const std::string& s) {
    int v = std::stoi(s);                          // throws std::invalid_argument on junk
    if (v < 1 || v > 65535) throw std::out_of_range("port out of range");
    return v;
}

try {
    int p = parse_port(text);
} catch (const std::out_of_range& e) {             // most specific first
    log(e.what());
} catch (const std::exception& e) {                // then the general base class
    log(e.what());
}
```

- Throw **by value**, catch **by const reference** (catching by value slices derived exceptions).
- Throwing *unwinds the stack*: every local object's destructor runs on the way out. That's why RAII makes code exception-safe almost for free.
- `throw;` inside a `catch` rethrows the **same** exception object.
- Derive your own types from the standard ones (`std::runtime_error` for "things that go wrong at runtime", `std::logic_error` for bugs) and add the data callers need, like a line number.

### When to use exceptions

| Situation | Tool |
|---|---|
| A bug (broken invariant, impossible state) | `assert`, or crash loudly |
| An expected "no result" (lookup miss) | `std::optional` |
| A failure the immediate caller handles | error code, `std::optional`, `std::expected` (C++23) |
| A failure that must travel up many layers (bad config, lost connection) | an **exception** |

Many codebases have their own rules (some games and embedded systems ban exceptions entirely), so always follow the house style.

### Exception safety guarantees

When a function throws, what state are things left in?

| Guarantee | Promise |
|---|---|
| **No-throw** (`noexcept`) | never throws. Destructors, `swap` and move operations should be here |
| **Strong** | if it throws, it's as if the call never happened (commit or roll back) |
| **Basic** | if it throws, nothing leaks and objects are still valid, but values may have changed |
| none | anything goes. This is a bug |

Two classic ways to get the strong guarantee:

1. **Copy-and-swap:** do all the work that might throw on a *copy*, then `swap` it in with an operation that can't throw.
2. **Undo on failure:** order the steps so the *undo* of each step can't throw, and in `catch (...)` undo, then `throw;`.

## Your tasks

All four parts are declared in `src/errors.h` with their exact rules. Implement them in `src/errors.cpp` and `src/append_all.tpp`.

1. **ConfigError and parsing.** Build the `"line N: message"` text in the constructor, then write `parse_config` and `get_int`.
2. **transfer** with the strong guarantee. The current version loses money when the destination is frozen.
3. **append_all** with the strong guarantee. The test uses a type whose copy constructor throws partway through.
4. **run**, the program boundary: nothing escapes; exceptions become messages and exit codes.
5. Grade (`bash ../../tools/grade.sh 05-exceptions`), then commit and push.

## Done when

All tests pass, both normally and under AddressSanitizer, which also checks that nothing leaks when exceptions fly.

## Hints

- `std::runtime_error` stores the message you pass its constructor, so build the full `"line N: ..."` string in the member initializer list.
- `get_int`: `std::from_chars` tells you whether the **whole** string was a number (compare the returned pointer with the end).
- `transfer`: if you withdraw first and the deposit throws, can you always put the money back? What if you deposit first instead, and the withdrawal throws?
- `append_all`: copy `dst`, append to the copy, then `dst.swap(copy)`. `swap` never throws.
- `run`: catch `ConfigError` **before** `std::exception`, or the general handler catches everything.

## Stretch goals

- Mark the functions that can't throw `noexcept`, and check with `static_assert(noexcept(...))`.
- Rewrite `get_int` to return `std::expected<int, std::string>` (C++23, `-std=c++23` with GCC 12+) and compare the call sites.
