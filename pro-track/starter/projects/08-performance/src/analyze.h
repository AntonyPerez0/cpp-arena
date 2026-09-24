#pragma once

#include <cstddef>
#include <string>
#include <vector>

// One log line looks like:   <timestamp> <user> <action> <latency_ms>
// for example:               1717171717 ropz buy 42
// Lines that don't have 4 fields, or whose latency isn't a whole number, are skipped.
struct Report {
    std::size_t lines = 0;          // valid lines
    std::size_t unique_users = 0;
    std::string busiest_user;       // most lines; ties go to the alphabetically first name
    int p95_latency = 0;            // nearest-rank 95th percentile: sorted[ceil(0.95 * n) - 1]
    std::string slowest_action;     // highest average latency; ties alphabetical
};

Report analyze(const std::vector<std::string>& lines);
