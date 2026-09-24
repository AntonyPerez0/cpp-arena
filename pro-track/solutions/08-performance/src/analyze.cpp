#include "analyze.h"

#include <algorithm>
#include <charconv>
#include <string_view>
#include <unordered_map>

namespace {

// Splits one line into exactly four space-separated fields without allocating.
bool parse(std::string_view line, std::string_view& user, std::string_view& action, int& latency) {
    std::string_view f[4];
    std::size_t n = 0, i = 0;
    while (i < line.size()) {
        while (i < line.size() && line[i] == ' ') i++;
        if (i == line.size()) break;
        std::size_t j = line.find(' ', i);
        if (j == std::string_view::npos) j = line.size();
        if (n == 4) return false;  // extra field
        f[n++] = line.substr(i, j - i);
        i = j;
    }
    if (n != 4) return false;
    std::string_view lat = f[3];
    if (lat.empty() || lat.size() > 9) return false;
    for (char c : lat)
        if (c < '0' || c > '9') return false;
    std::from_chars(lat.data(), lat.data() + lat.size(), latency);
    user = f[1];
    action = f[2];
    return true;
}

struct ActionStats {
    long long total = 0;
    long long count = 0;
};

}  // namespace

Report analyze(const std::vector<std::string>& lines) {
    Report r;
    // Views point into `lines`, which outlives these maps, so no strings are copied per line.
    std::unordered_map<std::string_view, int> users;
    std::unordered_map<std::string_view, ActionStats> actions;
    std::vector<int> latencies;
    users.reserve(lines.size() / 2);
    latencies.reserve(lines.size());

    for (const std::string& line : lines) {
        std::string_view user, action;
        int latency = 0;
        if (!parse(line, user, action, latency)) continue;
        r.lines++;
        users[user]++;
        auto& a = actions[action];
        a.total += latency;
        a.count++;
        latencies.push_back(latency);
    }

    r.unique_users = users.size();
    int best = -1;
    std::string_view busiest;
    for (const auto& [name, count] : users) {
        if (count > best || (count == best && name < busiest)) {
            best = count;
            busiest = name;
        }
    }
    r.busiest_user = std::string(busiest);

    if (!latencies.empty()) {
        std::size_t rank = (95 * latencies.size() + 99) / 100;  // ceil(0.95 * n)
        // Selection, not a full sort: O(n) on average.
        std::nth_element(latencies.begin(), latencies.begin() + static_cast<long>(rank - 1), latencies.end());
        r.p95_latency = latencies[rank - 1];
    }

    double best_avg = -1;
    std::string_view slowest;
    for (const auto& [name, s] : actions) {
        double avg = static_cast<double>(s.total) / static_cast<double>(s.count);
        if (avg > best_avg || (avg == best_avg && name < slowest)) {
            best_avg = avg;
            slowest = name;
        }
    }
    r.slowest_action = std::string(slowest);
    return r;
}
