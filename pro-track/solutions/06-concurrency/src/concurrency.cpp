#include "concurrency.h"

#include <sstream>

ThreadPool::ThreadPool(unsigned threads) {
    for (unsigned i = 0; i < threads; i++) {
        workers_.emplace_back([this] {
            while (auto job = jobs_.pop()) (*job)();
        });
    }
}

ThreadPool::~ThreadPool() {
    jobs_.close();  // workers finish what's queued, then pop() returns nullopt
    for (auto& w : workers_) w.join();
}

std::map<std::string, int> parallel_word_count(const std::vector<std::string>& docs, unsigned threads) {
    if (threads == 0) threads = 1;
    // Each thread writes only to its own map, so there's nothing to lock.
    std::vector<std::map<std::string, int>> partial(threads);
    std::vector<std::thread> workers;
    for (unsigned t = 0; t < threads; t++) {
        workers.emplace_back([&docs, &partial, t, threads] {
            for (std::size_t i = t; i < docs.size(); i += threads) {
                std::istringstream in(docs[i]);
                std::string w;
                while (in >> w) partial[t][w]++;
            }
        });
    }
    for (auto& w : workers) w.join();  // join() also makes every write visible to this thread
    std::map<std::string, int> counts;
    for (const auto& m : partial)
        for (const auto& [word, n] : m) counts[word] += n;
    return counts;
}
