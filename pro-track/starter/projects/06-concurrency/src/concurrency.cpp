#include "concurrency.h"

#include <sstream>

ThreadPool::ThreadPool(unsigned threads) {
    // TODO: start `threads` workers. Each loops: pop a job, run it, until pop() returns nullopt.
    (void)threads;
}

ThreadPool::~ThreadPool() {
    // TODO: close the queue, then join every worker.
}

std::map<std::string, int> parallel_word_count(const std::vector<std::string>& docs, unsigned threads) {
    // This version has a data race: every thread writes to the same map with no lock.
    // ThreadSanitizer will report it. Fix it (hint: give each thread its own map, merge at the end).
    std::map<std::string, int> counts;
    std::vector<std::thread> workers;
    for (unsigned t = 0; t < threads; t++) {
        workers.emplace_back([&, t] {
            for (std::size_t i = t; i < docs.size(); i += threads) {
                std::istringstream in(docs[i]);
                std::string w;
                while (in >> w) counts[w]++;
            }
        });
    }
    for (auto& w : workers) w.join();
    return counts;
}
