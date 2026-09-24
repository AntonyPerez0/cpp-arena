# 06 · Concurrency: threads, mutexes and ThreadSanitizer

Servers handle thousands of requests at once, and every modern CPU has many cores. Concurrent code is also where the nastiest bugs live: **data races** that corrupt memory once in a million runs, and **deadlocks** that freeze a service at 3 a.m. You'll build three classic pieces (a blocking queue, a thread pool and a parallel algorithm) and prove them race-free with ThreadSanitizer.

**You'll practice:** `std::thread`, `std::mutex` and lock guards, `std::condition_variable`, `std::future`/`std::packaged_task`, atomics, and ThreadSanitizer.

## Background

### Threads and data races

```cpp
std::thread t([] { do_work(); });   // starts running immediately
t.join();                            // wait for it to finish (you MUST join or detach)
```

A **data race** is two threads accessing the same memory at the same time, with at least one writing and no synchronization. It's **undefined behavior**, even for something as small as `count++` (a read, an add and a write that can interleave).

Three ways to share safely:

| Tool | Use it for |
|---|---|
| `std::mutex` + `std::lock_guard` / `std::unique_lock` | protecting data structures; only one thread inside at a time |
| `std::atomic<int>` | single counters and flags |
| **not sharing** | give each thread its own data and combine at the end. Often the fastest and simplest |

```cpp
std::mutex m;
{
    std::lock_guard<std::mutex> lock(m);   // locked here
    shared_map[key]++;
}                                          // unlocked automatically (RAII), even on exceptions
```

### Waiting with condition variables

A consumer waiting for work shouldn't spin in a loop burning CPU. A `std::condition_variable` lets it **sleep** until another thread notifies it:

```cpp
std::unique_lock<std::mutex> lock(m);
cv.wait(lock, [&] { return !queue.empty() || closed; });   // releases m while sleeping
```

Always wait **with a predicate**: threads can wake up spuriously, and the predicate also covers notifications that happened before you started waiting. The producer changes the state under the lock, then calls `cv.notify_one()` (or `notify_all()` when everyone needs to re-check, like on shutdown).

### Futures

`std::packaged_task<R()>` wraps a function, and its `get_future()` gives a `std::future<R>`. Another thread runs the task, and `future.get()` waits for and returns the result (or rethrows the task's exception). That's how the thread pool hands results back.

### ThreadSanitizer

```bash
cmake -S . -B build-tsan -G Ninja -DARENA_SANITIZE=thread
cmake --build build-tsan && ctest --test-dir build-tsan --output-on-failure
```

TSan instruments every memory access and reports races with **both** stack traces: the two conflicting accesses. It needs no luck: a race is reported even if it didn't corrupt anything on that run.

## Your tasks

1. **BlockingQueue** (`src/concurrency.tpp`): lock every access to `items_` and `closed_`, make `pop()` wait on the condition variable, and make `close()` wake everyone.
2. **ThreadPool** (`src/concurrency.cpp`): the constructor starts workers that loop `while (auto job = jobs_.pop()) (*job)();`. The destructor closes the queue and joins them all. (`submit` is written for you. Read it.)
3. **parallel_word_count**: run it under TSan to see the race report, then fix it.
4. Grade (`bash ../../tools/grade.sh 06-concurrency`), then commit and push.

## Done when

All tests pass, normally and three times in a row under ThreadSanitizer with no reports.

## Hints

- If a test hangs, a `pop()` is waiting for a notification that never comes (check `close()`), or a worker never exits (check the destructor).
- Notify **after** releasing the lock (put the lock in its own `{ }` block). It's correct either way, but this avoids waking a thread that immediately blocks on the mutex.
- For the word count: a `std::vector<std::map<std::string, int>>` with one map per thread, merged after `join()`.

## Stretch goals

- Add `std::optional<T> try_pop_for(std::chrono::milliseconds)` using `cv.wait_for`.
- Write a deliberate deadlock (two mutexes locked in opposite orders by two threads), watch it hang, then fix it with `std::scoped_lock(m1, m2)`.
- Benchmark `parallel_word_count` with 1, 2, 4 and 8 threads on a big input and explain the results.
