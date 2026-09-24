# 12 · Capstone B: a C library with a clean API

Huge amounts of the world's software (operating systems, databases, SQLite, curl, OpenSSL, zlib, game engines) are C libraries used by programs in every other language. Designing one well is a craft: other people depend on your **interface** for years, so it has to be clear about ownership, errors and threads, and it must never leak or crash, even when memory runs out.

You'll implement `strmap`, a string-to-string hash map, to the standard of a real library release.

**You'll practice:** opaque types, error codes, ownership rules, handling allocation failure, symbol visibility, header hygiene for C and C++, Valgrind, and API documentation.

## Background

### The interface is the product

`include/strmap.h` is written for you and is the contract. Read every comment. Notice the design choices:

- **Opaque type**: `typedef struct strmap strmap;` Users only hold a pointer and never see the fields, so you can change the implementation without breaking them. That keeps the **ABI** (binary interface) stable.
- **Error codes** as an `enum` return value, with `strmap_strerror` for messages. The C convention, since C has no exceptions.
- **Explicit ownership**: the map copies what it stores and frees its copies, and pointers from `strmap_get` are borrowed.
- `extern "C"` and `#ifndef` guards so the header works from C and C++.
- **A prefix on every name** (`strmap_`, `STRMAP_`). C has one global namespace, so every exported symbol must be unique across the whole program.

### Out of memory is a real case

`malloc` can return `NULL`. Library code must handle it on **every** allocation, and should leave its data structures unchanged when it fails (the strong guarantee again). The pattern: **allocate everything first, then modify**. If a later allocation fails, free the earlier ones and return `STRMAP_ENOMEM`.

The tests use `strmap_set_allocator` to make the N-th allocation fail, for every N from 0 to 39, and check that nothing leaks and no data is lost.

### Symbol hygiene

Every non-`static` function in your `.c` file becomes an exported symbol that can clash with someone else's. Make all helpers `static`. The grader runs `nm` on the library and rejects anything exported that isn't `strmap_*`.

### Valgrind

```bash
valgrind --leak-check=full ./build/strmap_test
```

Valgrind runs your *unmodified* binary on a simulated CPU and reports invalid reads and writes, uses of uninitialized memory, and leaks. It's slower than ASan but needs no rebuild, and it catches some bugs ASan misses (like reading uninitialized memory).

## Your tasks

1. Design `struct strmap` in `src/strmap.c`. A hash table with separate chaining (like the Arena's hash table module) and a power-of-two bucket count works well. Grow it when the load factor passes 0.75.
2. Implement every function in the header. Keep helpers `static`.
3. Handle allocation failure everywhere, using `g_alloc`/`g_free`-style function pointers that `strmap_set_allocator` can replace.
4. Write `API.md` (at least 150 words): ownership rules, error handling, thread safety, and versioning.
5. Grade (`bash ../../tools/grade.sh 12-clib`), then commit and push.

## Done when

- all tests pass, normally, under AddressSanitizer, and under Valgrind with zero leaks,
- the header compiles as strict C99 and as C++,
- the library exports only `strmap_*` symbols,
- the example program runs,
- `API.md` documents the library.

## Hints

- In `strmap_put`, copy the value first. If the key already exists, swap in the new value copy and free the old one. For a new key, allocate the entry and the key copy, and free everything allocated so far if any step fails.
- Growing the table can also fail. That's fine: keep using the old table. It's still correct, just slower.
- Store each entry's full hash, so growing doesn't recompute it and lookups can compare hashes before strings.
- `strmap_foreach` stops as soon as the callback returns nonzero.

## Stretch goals

- Build it as a shared library too (`add_library(strmap SHARED ...)`), set `-fvisibility=hidden`, and mark the API with `__attribute__((visibility("default")))`.
- Add an iterator API (`strmap_iter`) as an alternative to callbacks, and write down the trade-offs.
- Write a C++ RAII wrapper class around the C API.
