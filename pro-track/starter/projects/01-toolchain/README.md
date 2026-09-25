# 01 · Compilers, linking and CMake

On the Arena site one file became one program in a single click. Real projects have hundreds of files, several libraries and a build system that ties them together. In this project you'll see every stage a C or C++ build goes through, then describe a small project in **CMake**, the build tool most C and C++ companies use.

**You'll practice:** the four build stages, object files and the linker, headers vs. source files, static libraries, reading linker errors, and CMake targets.

## Background

### From source to program

`gcc main.c -o main` hides four separate steps:

| Stage | Command to stop there | Output |
|---|---|---|
| 1. Preprocess: expand `#include` and macros | `gcc -E main.c` | one big C file |
| 2. Compile: C to assembly | `gcc -S main.c` | `main.s` |
| 3. Assemble: assembly to machine code | `gcc -c main.c` | `main.o` (an *object file*) |
| 4. Link: join objects and libraries | `gcc main.o util.o -o main` | the program |

Each `.c` file is compiled **on its own** into an object file. It only needs *declarations* (from headers) of what it calls. The **linker** then connects every call to the one *definition* somewhere in the objects and libraries. That's why:

- a missing header gives a **compile** error ("implicit declaration"), while
- a missing `.c` file or library gives a **link** error: `undefined reference to 'str_trim'`.

Try it in the terminal from this folder:

```bash
gcc -Iinclude -c src/strutil.c -o /tmp/strutil.o      # compile only
nm /tmp/strutil.o                                     # list its symbols: T = defined here
gcc -Iinclude src/wordfreq.c -o /tmp/wf               # fails: undefined reference
ar rcs /tmp/libstrutil.a /tmp/strutil.o               # bundle objects into a static library
gcc -Iinclude src/wordfreq.c /tmp/libstrutil.a -o /tmp/wf   # links now
```

A **static library** (`.a`) is just an archive of object files copied into the program at link time. A **shared library** (`.so`, `.dll`) is loaded when the program starts, so several programs share one copy and it can be updated separately.

### Make: the classic build tool

Before CMake there was **Make**, and it's still everywhere: in older projects, in the Linux kernel, and as one of the backends CMake itself generates. A `Makefile` is a list of **rules**. Each rule says "this target is built from these prerequisites, with these commands":

```make
CC     = gcc
CFLAGS = -std=c17 -Wall -Wextra -Iinclude -MMD -MP

wordfreq: obj/wordfreq.o obj/libstrutil.a
	$(CC) $^ -o $@

obj/libstrutil.a: obj/strutil.o
	ar rcs $@ $^

obj/%.o: src/%.c | obj
	$(CC) $(CFLAGS) -c $< -o $@

obj:
	mkdir -p obj

clean:
	rm -rf obj wordfreq

.PHONY: clean
-include obj/*.d
```

- Run `make` to build the first target (`wordfreq`) and `make clean` to start over.
- Make compares timestamps. A target is rebuilt only when one of its prerequisites is newer, so editing `strutil.c` recompiles one file and relinks, nothing else.
- `$@` is the target, `$<` is the first prerequisite and `$^` is all of them. `%` is a pattern, so one rule compiles every `src/X.c` into `obj/X.o`.
- **Recipe lines must start with a real tab character**, not spaces. "missing separator" is the error you get otherwise.
- `-MMD -MP` makes the compiler write a `.d` file listing the headers each object included, and `-include` reads them, so changing `strutil.h` rebuilds everything that uses it.
- `| obj` is an *order-only* prerequisite: the folder must exist, but its timestamp never triggers a rebuild.

Make works well for small projects, but you spell out compilers, flags, platforms and dependencies yourself. CMake describes *what* to build and generates files like this one for you.

### CMake in five minutes

Typing those commands doesn't scale. CMake reads a `CMakeLists.txt` and generates the real build (Ninja or Make) for you. Modern CMake is all about **targets**:

```cmake
add_library(geometry STATIC src/shapes.c)              # a library target
target_include_directories(geometry PUBLIC include)    # its headers
add_executable(app src/main.c)                         # a program target
target_link_libraries(app PRIVATE geometry)            # app uses geometry
```

- `PUBLIC` means "me **and** anyone who links me". Include directories for a library's own headers are usually PUBLIC, so linking the library is all a user needs.
- `PRIVATE` means "only me".

Building is always the same two commands:

```bash
cmake -S . -B build -G Ninja      # configure: generate the build in build/
cmake --build build               # build everything that changed
ctest --test-dir build            # run the tests
```

The shared file `cmake/arena.cmake` (included at the top) already turns on C17/C++20, `-Wall -Wextra -Wpedantic -Werror`, optional sanitizers and GoogleTest.

## Your tasks

1. **Implement the library.** Fill in the four functions in `src/strutil.c`. The comments in `include/strutil.h` are the specification. Use `isspace` and `tolower` from `<ctype.h>`, and cast characters to `unsigned char` before passing them (passing a negative `char` is undefined behavior).
2. **Describe the build.** Complete TODO 1 and TODO 2 in `CMakeLists.txt`.
3. **Build and test** until everything is green:
   ```bash
   cmake -S . -B build -G Ninja && cmake --build build && ctest --test-dir build --output-on-failure
   ./build/wordfreq tests/sample.txt
   ```
4. **Grade it** exactly like GitHub will: `bash ../../tools/grade.sh 01-toolchain`
5. Commit and push. The **Grade** workflow runs on GitHub; open the **Actions** tab to see the result.

## Done when

- the project builds with no warnings (they're errors here),
- all unit tests pass,
- `wordfreq tests/sample.txt` prints the top three words, and running it with no argument exits with code 2.

## Hints

- `str_trim`: find the first non-space character, find the last one, then `memmove` the middle to the start (the ranges overlap, so `memcpy` would be wrong).
- `str_next_word`: skip spaces; if you hit `'\0'` return 0. Otherwise copy characters until the next space, but only while there's room for the terminator.
- `undefined reference to ...`: the linker can't find a definition. Did you add the library and link it?
- `fatal error: strutil.h: No such file or directory`: the include directory isn't set on the target (or isn't PUBLIC).

## Stretch goals

- Add `option(STRUTIL_SHARED ...)` and build strutil as a `SHARED` library, then run `ldd build/wordfreq` to see it loaded at runtime.
- Run `cmake --build build --verbose` and read the exact compiler and linker commands CMake generated.
- Save the Makefile above as `Makefile` in this folder and build with plain `make`. Touch `include/strutil.h` and run `make` again to watch both objects rebuild; touch only `src/wordfreq.c` and only that one does. Then run `cmake -S . -B build-make -G "Unix Makefiles"` and open `build-make/Makefile` to see what CMake generates.
