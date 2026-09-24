#include "kv_store.h"

#include <mutex>

namespace {

// Applies one log line to the map. Unknown or damaged lines (for example a
// half-written last line after a crash) are ignored.
void replay_line(std::unordered_map<std::string, std::string>& data, const std::string& line) {
    if (line.rfind("SET ", 0) == 0) {
        auto sp = line.find(' ', 4);
        if (sp == std::string::npos) return;
        data[line.substr(4, sp - 4)] = line.substr(sp + 1);
    } else if (line.rfind("DEL ", 0) == 0) {
        data.erase(line.substr(4));
    }
}

}  // namespace

KvStore::KvStore(const std::string& path) {
    if (path.empty()) return;
    if (std::FILE* in = std::fopen(path.c_str(), "r")) {
        std::string line;
        int c;
        while ((c = std::fgetc(in)) != EOF) {
            if (c == '\n') {
                replay_line(data_, line);
                line.clear();
            } else {
                line += static_cast<char>(c);
            }
        }
        std::fclose(in);  // a trailing line without '\n' was never completely written: skip it
    }
    log_ = std::fopen(path.c_str(), "a");
}

KvStore::~KvStore() {
    if (log_) std::fclose(log_);
}

void KvStore::set(const std::string& key, const std::string& value) {
    std::unique_lock lock(m_);
    if (log_) {
        std::fprintf(log_, "SET %s %s\n", key.c_str(), value.c_str());
        std::fflush(log_);
    }
    data_[key] = value;
}

std::optional<std::string> KvStore::get(const std::string& key) const {
    std::shared_lock lock(m_);
    auto it = data_.find(key);
    if (it == data_.end()) return std::nullopt;
    return it->second;
}

bool KvStore::del(const std::string& key) {
    std::unique_lock lock(m_);
    if (data_.erase(key) == 0) return false;
    if (log_) {
        std::fprintf(log_, "DEL %s\n", key.c_str());
        std::fflush(log_);
    }
    return true;
}

std::size_t KvStore::size() const {
    std::shared_lock lock(m_);
    return data_.size();
}
