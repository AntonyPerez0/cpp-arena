#pragma once
#include <string>
#include <vector>

// Builds a deterministic synthetic log with `n` lines (a few malformed).
inline std::vector<std::string> generate_log(std::size_t n) {
    static const char* actions[] = {"buy", "sell", "login", "logout", "match", "chat", "trade", "inspect"};
    std::vector<std::string> out;
    out.reserve(n);
    unsigned long long x = 88172645463325252ULL;
    for (std::size_t i = 0; i < n; i++) {
        x ^= x << 13;
        x ^= x >> 7;
        x ^= x << 17;
        if (i % 1000 == 999) {
            out.push_back("garbage line");
            continue;
        }
        std::string user = "user" + std::to_string(x % 60000);
        const char* action = actions[(x >> 20) % 8];
        int latency = static_cast<int>((x >> 33) % 2000) + static_cast<int>((x >> 40) % 8) * 10;
        out.push_back(std::to_string(1700000000 + i) + " " + user + " " + action + " " + std::to_string(latency));
    }
    return out;
}
