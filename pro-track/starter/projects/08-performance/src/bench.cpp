// Times analyze() on a large synthetic log:  ./build/bench [lines]
#include <chrono>
#include <cstdlib>
#include <iostream>

#include "analyze.h"
#include "generate.h"

int main(int argc, char** argv) {
    std::size_t n = argc > 1 ? std::strtoul(argv[1], nullptr, 10) : 200000;
    auto log = generate_log(n);
    auto start = std::chrono::steady_clock::now();
    Report r = analyze(log);
    auto ms = std::chrono::duration_cast<std::chrono::milliseconds>(std::chrono::steady_clock::now() - start).count();
    std::cout << n << " lines in " << ms << " ms: users=" << r.unique_users << " busiest=" << r.busiest_user
              << " p95=" << r.p95_latency << " slowest=" << r.slowest_action << "\n";
}
