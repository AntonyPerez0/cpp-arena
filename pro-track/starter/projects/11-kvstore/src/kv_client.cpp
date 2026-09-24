#include "kv_client.h"

#include <arpa/inet.h>
#include <netinet/in.h>
#include <sys/socket.h>
#include <unistd.h>

#include <cerrno>

KvClient::KvClient(int port) {
    fd_ = ::socket(AF_INET, SOCK_STREAM | SOCK_CLOEXEC, 0);
    if (fd_ < 0) return;
    sockaddr_in addr{};
    addr.sin_family = AF_INET;
    addr.sin_addr.s_addr = htonl(INADDR_LOOPBACK);
    addr.sin_port = htons(static_cast<uint16_t>(port));
    if (::connect(fd_, reinterpret_cast<sockaddr*>(&addr), sizeof addr) != 0) {
        ::close(fd_);
        fd_ = -1;
    }
}

KvClient::~KvClient() {
    if (fd_ >= 0) ::close(fd_);
}

std::string KvClient::request(const std::string& line) {
    if (fd_ < 0) return "";
    std::string msg = line + "\n";
    const char* p = msg.data();
    std::size_t left = msg.size();
    while (left > 0) {
        ssize_t n = ::send(fd_, p, left, MSG_NOSIGNAL);
        if (n < 0) {
            if (errno == EINTR) continue;
            return "";
        }
        p += n;
        left -= static_cast<std::size_t>(n);
    }
    while (true) {
        auto nl = buffer_.find('\n');
        if (nl != std::string::npos) {
            std::string reply = buffer_.substr(0, nl);
            buffer_.erase(0, nl + 1);
            return reply;
        }
        char buf[4096];
        ssize_t n = ::recv(fd_, buf, sizeof buf, 0);
        if (n < 0 && errno == EINTR) continue;
        if (n <= 0) return "";
        buffer_.append(buf, static_cast<std::size_t>(n));
    }
}
