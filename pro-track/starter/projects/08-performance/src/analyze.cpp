#include "analyze.h"

#include <algorithm>
#include <sstream>

// Correct, but far too slow for big logs. Profile it, then make it fast.

static bool parse(std::string line, std::string& user, std::string& action, int& latency) {
    std::stringstream in(line);
    std::string ts, lat;
    if (!(in >> ts >> user >> action >> lat)) return false;
    std::string extra;
    if (in >> extra) return false;
    for (char c : lat)
        if (c < '0' || c > '9') return false;
    if (lat.empty() || lat.size() > 9) return false;
    latency = std::stoi(lat);
    return true;
}

Report analyze(const std::vector<std::string>& lines) {
    Report r;
    std::vector<std::string> users;
    std::vector<int> counts;
    std::vector<std::string> actions;
    std::vector<long long> action_total;
    std::vector<long long> action_count;
    std::vector<int> latencies;

    for (std::size_t i = 0; i < lines.size(); i++) {
        std::string user, action;
        int latency = 0;
        if (!parse(lines[i], user, action, latency)) continue;
        r.lines++;

        auto u = std::find(users.begin(), users.end(), user);
        if (u == users.end()) {
            users.push_back(user);
            counts.push_back(1);
        } else {
            counts[u - users.begin()]++;
        }

        auto a = std::find(actions.begin(), actions.end(), action);
        if (a == actions.end()) {
            actions.push_back(action);
            action_total.push_back(latency);
            action_count.push_back(1);
        } else {
            action_total[a - actions.begin()] += latency;
            action_count[a - actions.begin()]++;
        }

        latencies.push_back(latency);
        std::sort(latencies.begin(), latencies.end());
    }

    r.unique_users = users.size();
    for (std::size_t i = 0; i < users.size(); i++) {
        if (r.busiest_user.empty()) {
            r.busiest_user = users[i];
            continue;
        }
        std::size_t best = std::find(users.begin(), users.end(), r.busiest_user) - users.begin();
        if (counts[i] > counts[best] || (counts[i] == counts[best] && users[i] < users[best])) r.busiest_user = users[i];
    }

    if (!latencies.empty()) {
        std::size_t n = latencies.size();
        std::size_t rank = (95 * n + 99) / 100;  // ceil(0.95 * n)
        r.p95_latency = latencies[rank - 1];
    }

    double best_avg = -1;
    for (std::size_t i = 0; i < actions.size(); i++) {
        double avg = static_cast<double>(action_total[i]) / action_count[i];
        if (avg > best_avg || (avg == best_avg && actions[i] < r.slowest_action)) {
            best_avg = avg;
            r.slowest_action = actions[i];
        }
    }
    return r;
}
