# 10 · POSIX systems programming: processes, files and sockets

Underneath every C++ library for files, processes and networking sit the operating system's **system calls**. On Linux and macOS they follow the POSIX standard, and they're C functions. Knowing them lets you debug what libraries do, write high-performance servers, and read the huge amount of C and C++ infrastructure code that uses them directly.

**You'll practice:** file descriptors, `open`/`read`/`write`/`close`, `errno` and `EINTR`, `fork`/`exec`/`waitpid`, pipes, and TCP sockets (`socket`/`bind`/`listen`/`accept`/`connect`).

## Background

### File descriptors

Everything the kernel gives you (a file, a pipe, a socket, the terminal) is a small integer, a **file descriptor**. 0, 1 and 2 are stdin, stdout and stderr.

```cpp
int fd = open("data.bin", O_RDONLY | O_CLOEXEC);
if (fd < 0) { perror("open"); return false; }      // errno says why
ssize_t n = read(fd, buf, sizeof buf);              // may return FEWER bytes than asked
close(fd);
```

Three rules everyone learns the hard way:

1. **Check every return value.** -1 means failure and `errno` holds the reason.
2. **Short reads and writes are normal.** `write` may write only part of the buffer, so loop until it's all written.
3. **`EINTR`**: a signal can interrupt a blocking call. It isn't an error; retry.

`O_CLOEXEC` stops the descriptor from leaking into programs you `exec`, and close every descriptor exactly once.

### Processes

```cpp
pid_t pid = fork();              // now there are two copies of your program
if (pid == 0) {                  // in the child
    execvp(argv[0], argv);       // replace the child with another program
    _exit(127);                  // only reached if exec failed
}
int status;
waitpid(pid, &status, 0);        // parent: wait, then decode:
WIFEXITED(status) && WEXITSTATUS(status);   // normal exit code
WIFSIGNALED(status) && WTERMSIG(status);    // killed by a signal
```

A **pipe** is a one-way channel: `pipe(fds)` gives a read end and a write end. `dup2(fds[1], STDOUT_FILENO)` in the child makes its stdout go into the pipe. That's exactly how shells implement `a | b`.

Between `fork` and `exec` in the child, only call *async-signal-safe* functions (`dup2`, `close`, `execvp`, `_exit`). No memory allocation, no `std::cout`.

### TCP sockets

```
server: socket -> bind(address, port) -> listen -> accept (blocks until a client connects) -> read/write
client: socket -> connect(address, port) -> write/read
```

Binding to port 0 lets the OS pick a free port, and `getsockname` tells you which. Use `send(..., MSG_NOSIGNAL)` so a disconnected peer doesn't kill your process with `SIGPIPE`. To stop a server blocked in `accept`, `shutdown()` the listening socket from another thread.

`man 2 read`, `man 2 fork`, `man 7 tcp`: the man pages are the real reference. Get used to reading them.

## Your tasks

Implement the functions in `src/posix.cpp`. Their exact contracts are in `src/posix.h`.

1. `copy_file`: `open`, a `read`/`write` loop with short-write and `EINTR` handling, `close`.
2. `run_capture`: two pipes, `fork`, `dup2` + `execvp` in the child, write the input and read the output in the parent, `waitpid`, decode the status.
3. `EchoServer` and `echo_once`: a small TCP server and client on 127.0.0.1.
4. Grade (`bash ../../tools/grade.sh 10-posix`), then commit and push.

## Done when

All tests pass, normally and under AddressSanitizer.

## Hints

- `run_capture`: if the child writes a lot before reading its input, writing all the input first **deadlocks** (both sides wait on full pipes). Write the input on a separate `std::thread` while the main thread reads the output.
- Close the pipe ends you don't use in each process, or `read` never sees EOF.
- Ignore `SIGPIPE` (`signal(SIGPIPE, SIG_IGN)`) before writing to a child that may exit without reading.
- If `bind` fails with "address already in use", you're not using port 0 (or forgot `SO_REUSEADDR`).
- Debug with `strace -f ./build/posix_test --gtest_filter=Echo.*` to see every system call.

## Stretch goals

- Serve several clients at once: one thread per client, or a single thread with `poll()`.
- Add a timeout to `echo_once` with `setsockopt(SO_RCVTIMEO)`.
- Write `run_pipeline({{"ls"}, {"sort"}, {"head", "-3"}})` that connects several processes like a shell.
