#pragma once

#include <cstdio>
#include <optional>
#include <shared_mutex>
#include <string>
#include <unordered_map>

// A thread-safe key-value map that survives restarts.
//
// Durability: every change is appended to a log file as one line,
//   "SET <key> <value>" or "DEL <key>",
// and flushed before the call returns. Opening a store replays the log.
// Keys never contain spaces or newlines; values never contain newlines.
class KvStore {
public:
    // Opens (creating if needed) the log at `path` and replays it.
    // An empty path means in-memory only (no persistence).
    explicit KvStore(const std::string& path = "");
    ~KvStore();
    KvStore(const KvStore&) = delete;
    KvStore& operator=(const KvStore&) = delete;

    void set(const std::string& key, const std::string& value);
    std::optional<std::string> get(const std::string& key) const;
    bool del(const std::string& key);  // false if the key wasn't there
    std::size_t size() const;

private:
    mutable std::shared_mutex m_;  // many readers OR one writer
    std::unordered_map<std::string, std::string> data_;
    std::FILE* log_ = nullptr;
};
