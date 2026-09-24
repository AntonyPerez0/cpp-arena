#pragma once

#include <condition_variable>
#include <functional>
#include <future>
#include <map>
#include <mutex>
#include <optional>
#include <queue>
#include <string>
#include <thread>
#include <vector>

// ---------------------------------------------------------------- part 1
// A thread-safe FIFO queue. Any number of threads may push and pop at once.
template <typename T>
class BlockingQueue {
public:
    // Adds an item and wakes one waiting consumer. Returns false (and drops the
    // item) if the queue was closed.
    bool push(T item);

    // Waits until an item is available and returns it. Once the queue is closed
    // AND empty, returns std::nullopt instead of waiting forever.
    std::optional<T> pop();

    // After close(), push() fails and waiting pop() calls wake up.
    void close();

    std::size_t size() const;

private:
    mutable std::mutex m_;
    std::condition_variable cv_;
    std::queue<T> items_;
    bool closed_ = false;
};

// ---------------------------------------------------------------- part 2
// A fixed set of worker threads that run submitted jobs.
class ThreadPool {
public:
    explicit ThreadPool(unsigned threads);
    // Finishes every job already submitted, then stops and joins the workers.
    ~ThreadPool();
    ThreadPool(const ThreadPool&) = delete;
    ThreadPool& operator=(const ThreadPool&) = delete;

    // Queues a job and returns a future for its result.
    template <typename F>
    auto submit(F f) -> std::future<decltype(f())>;

private:
    BlockingQueue<std::function<void()>> jobs_;
    std::vector<std::thread> workers_;
};

// ---------------------------------------------------------------- part 3
// Counts words (whitespace-separated) across all documents using `threads`
// threads. Must give the same answer as a single-threaded count, with no data races.
std::map<std::string, int> parallel_word_count(const std::vector<std::string>& docs, unsigned threads);

#include "concurrency.tpp"
