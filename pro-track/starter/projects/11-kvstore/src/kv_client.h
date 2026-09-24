#pragma once

#include <string>

// A blocking client for KvServer (provided; used by the tests).
class KvClient {
public:
    explicit KvClient(int port);
    ~KvClient();
    KvClient(const KvClient&) = delete;
    KvClient& operator=(const KvClient&) = delete;

    bool connected() const { return fd_ >= 0; }
    // Sends one request line and returns the reply line ("" on error).
    std::string request(const std::string& line);

private:
    int fd_ = -1;
    std::string buffer_;
};
