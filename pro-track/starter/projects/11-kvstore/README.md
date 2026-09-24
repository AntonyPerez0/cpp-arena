# 11 · Capstone A: a multi-threaded key-value server

Time to build something real: a small networked database, like a minimal Redis. Clients connect over TCP and send `SET`, `GET` and `DEL` commands. Many clients are served at once, and the data survives restarts. This pulls together almost everything in the track: classes and RAII, containers, threads and locks, sockets, files, testing, and sanitizers.

**You'll practice:** designing a component, reader/writer locking, a network protocol, crash-safe persistence, clean shutdown, and explaining your design in writing.

## The spec

The headers are the contract. Read them first:

- `src/kv_store.h`: a thread-safe map with an append-only log file.
- `src/kv_server.h`: the TCP server and its line protocol.
- `src/kv_client.h`: a client (already implemented; the tests use it).

```
SET <key> <value...>   ->  OK
GET <key>              ->  VALUE <value>  or  NOT_FOUND
DEL <key>              ->  DELETED        or  NOT_FOUND
COUNT                  ->  COUNT <n>
anything else          ->  ERROR unknown command
```

Try the finished server by hand: `./build/kvserver data.log` in one terminal, then `nc 127.0.0.1 <port>` in another, and type commands.

## Background

### Readers and writers

Most requests are reads. A plain `std::mutex` makes every reader wait for every other reader. `std::shared_mutex` allows **many readers or one writer**:

```cpp
std::shared_lock lock(m_);   // in get(): shared with other readers
std::unique_lock lock(m_);   // in set()/del(): exclusive
```

### An append-only log

The simplest crash-safe storage: never modify old data, only append each change (`SET k v`, `DEL k`) and flush it. On startup, replay the log from the top to rebuild the map. Real databases (Redis's AOF, Kafka, the write-ahead log in PostgreSQL) build on the same idea.

- Append the log entry **while holding the write lock**, so the log order matches the order changes happened.
- A crash can leave a half-written last line. Ignore a final line with no `'\n'`.
- `fflush` hands data to the OS. Surviving a power cut needs `fsync`, which is slow. Mention that trade-off in your design notes.

### Serving many clients

The simplest model: one thread blocks in `accept()`, and each client gets its own thread that reads a request, calls `handle()`, and sends the reply. Keep the protocol logic in the static `handle()`, so it can be unit-tested without any sockets.

### Shutting down cleanly

The destructor must not hang even while clients are connected: set a stop flag, `shutdown()` the listening socket to wake `accept()`, join the acceptor, `shutdown()` every client socket to wake their `recv()`, then join those threads. Shutting down threads is where most real-world concurrency bugs hide, so the grader runs everything under ThreadSanitizer.

## Your tasks

1. `KvStore`, in memory first: make the store unit tests pass, including `ConcurrentWriters`.
2. Add persistence: replay in the constructor, append in `set`/`del`, close in the destructor.
3. `KvServer::handle`: the protocol tests.
4. The networking: constructor, `accept_loop`, `serve_client`, destructor. Reuse what you learned in project 10.
5. Write `DESIGN.md` (at least 150 words): your threading model, what each lock protects, how durability works and its limits, how shutdown works, and what you'd improve next.
6. Grade (`bash ../../tools/grade.sh 11-kvstore`), then commit and push.

## Done when

- all tests pass normally, under AddressSanitizer, and three times under ThreadSanitizer,
- `DESIGN.md` explains your design.

## Hints

- Values may contain spaces: `SET motd gl hf` stores `gl hf`. Split at the **first two** spaces only.
- Build the protocol reply as a string and `send` it in one call with `MSG_NOSIGNAL`.
- If a test hangs at the end, the destructor is waiting on a thread that's blocked in `accept` or `recv`. What wakes it up?
- If ThreadSanitizer reports a race on the list of client threads, check which threads touch it, and when.

## Stretch goals

- Replace thread-per-client with the `ThreadPool` from project 06, or with an `epoll` event loop.
- Add log **compaction**: when the log is much larger than the live data, rewrite it atomically (write a new file, `fsync`, `rename`).
- Add `EXPIRE <key> <seconds>`.
- Benchmark requests per second with 1, 8 and 64 clients.
