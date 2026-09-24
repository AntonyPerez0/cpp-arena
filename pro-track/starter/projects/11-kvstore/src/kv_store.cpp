#include "kv_store.h"

// TODO: implement the store. Start in memory only, then add the log.

KvStore::KvStore(const std::string& path) { (void)path; }

KvStore::~KvStore() {}

void KvStore::set(const std::string& key, const std::string& value) {
    (void)key;
    (void)value;
}

std::optional<std::string> KvStore::get(const std::string& key) const {
    (void)key;
    return std::nullopt;
}

bool KvStore::del(const std::string& key) {
    (void)key;
    return false;
}

std::size_t KvStore::size() const { return 0; }
