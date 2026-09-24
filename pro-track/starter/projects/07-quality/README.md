# 07 · Code quality: clang-tidy, clang-format and the Core Guidelines

On a real team, code isn't "done" when it works. It also has to pass the team's **automated quality gates**: a formatter so nobody argues about spaces in review, and a linter (static analyzer) that catches bug patterns and outdated idioms before a human even looks. Most C++ shops run **clang-format** and **clang-tidy** in CI, exactly like this project's grader.

`src/store.h` and `src/store.cpp` are working "legacy" code: the tests pass. But they fail both gates, and they hide a memory leak that neither tool catches. Clean them up without breaking anything.

**You'll practice:** clang-format, clang-tidy, the C++ Core Guidelines, and refactoring safely under tests.

## Background

### clang-format

A formatter rewrites whitespace, braces and line breaks to match a style file (`.clang-format` at the repository root; this track uses a Google-based style with 4-space indents).

```bash
clang-format -i src/*.h src/*.cpp tests/*.cpp          # fix files in place
clang-format --dry-run --Werror src/*.cpp              # just check (what CI does)
```

Most editors can format on save. In VS Code: *Format Document* (Shift+Alt+F).

### clang-tidy

clang-tidy understands your code the way the compiler does, so it can flag real problems:

| Check family | Example findings |
|---|---|
| `bugprone-*` | suspicious patterns: use after move, wrong `sizeof`, dangerous implicit conversions |
| `performance-*` | copying a `std::string` parameter that's only read, copying in range-for |
| `modernize-*` | `NULL` instead of `nullptr`, `virtual` instead of `override`, index loops |
| `readability-*` | missing braces, `else` after `return` |
| `cppcoreguidelines-*` | rules from the [C++ Core Guidelines](https://isocpp.github.io/CppCoreGuidelines/) such as the rule of five |

It needs the exact compiler flags, which CMake writes to `compile_commands.json` (the shared setup turns that on):

```bash
cmake -S . -B build -G Ninja
clang-tidy -p build src/store.cpp          # reads .clang-tidy in this folder
clang-tidy -p build --fix src/store.cpp    # applies the automatic fixes it's sure about
```

Review every `--fix` change (`git diff`) before trusting it. Some findings need a human decision.

### The Core Guidelines in one paragraph

The C++ Core Guidelines, edited by Bjarne Stroustrup and Herb Sutter, are the closest thing C++ has to an official style guide. You already know many of their rules from the Arena: RAII for every resource, the rule of zero/five, `const` by default, no owning raw pointers, pass read-only arguments by `const&`, `override` on every override. clang-tidy's `cppcoreguidelines-*` checks automate some of them.

## Your tasks

1. Build, run the tests, then run clang-tidy and read every warning. For each one, understand **why** it's a problem before fixing it.
2. Fix the code by hand or with `--fix`, then format with `clang-format -i`.
3. Find the leak that the tools don't see. Grade with AddressSanitizer on, or read the constructor carefully: who deletes the default `Pricing`? Prefer a design with no manual `new` and `delete` at all.
4. Keep the tests passing throughout. Don't change them.
5. Grade (`bash ../../tools/grade.sh 07-quality`), then commit and push.

## Done when

- `clang-tidy` reports nothing with the provided `.clang-tidy`,
- `clang-format --dry-run --Werror` finds nothing to change,
- the tests pass, including under AddressSanitizer with leak detection.

## Hints

- `cppcoreguidelines-special-member-functions` fires when a class declares a destructor but not the copy and move operations. For `Store`, the best fix is deleting the empty destructor (the rule of zero). For the polymorphic `Pricing` base, declare the other four as `= default`.
- Parameters you only read: `const std::string&`. Loops that only read: `for (const auto& item : items_)`.
- The leak: `Store` allocates a default `Pricing` with `new` but never deletes it. One clean fix is a `Pricing` member used when no pricing is passed in.

## Stretch goals

- Add `bugprone-use-after-move` bait (use a string after `std::move`) and watch the check fire.
- Set up a *pre-commit hook* (`.git/hooks/pre-commit`) that runs `clang-format --dry-run --Werror` on staged files.
