#include "kv_server.h"

#include <arpa/inet.h>
#include <netinet/in.h>
#include <sys/socket.h>
#include <unistd.h>

#include <algorithm>
#include <cerrno>

KvServer::KvServer(KvStore& store) : store_(store) {
    listen_fd_ = ::socket(AF_INET, SOCK_STREAM | SOCK_CLOEXEC, 0);
    if (listen_fd_ < 0) return;
    int yes = 1;
    ::setsockopt(listen_fd_, SOL_SOCKET, SO_REUSEADDR, &yes, sizeof yes);
    sockaddr_in addr{};
    addr.sin_family = AF_INET;
    addr.sin_addr.s_addr = htonl(INADDR_LOOPBACK);
    addr.sin_port = 0;
    if (::bind(listen_fd_, reinterpret_cast<sockaddr*>(&addr), sizeof addr) != 0 || ::listen(listen_fd_, 64) != 0) {
        ::close(listen_fd_);
        listen_fd_ = -1;
        return;
    }
    socklen_t len = sizeof addr;
    ::getsockname(listen_fd_, reinterpret_cast<sockaddr*>(&addr), &len);
    port_ = ntohs(addr.sin_port);
    acceptor_ = std::thread([this] { accept_loop(); });
}

KvServer::~KvServer() {
    stopping_ = true;
    if (listen_fd_ >= 0) ::shutdown(listen_fd_, SHUT_RDWR);  // wakes accept()
    if (acceptor_.joinable()) acceptor_.join();              // no new client threads after this
    {
        std::lock_guard<std::mutex> lock(clients_m_);
        for (int fd : client_fds_)
            if (fd >= 0) ::shutdown(fd, SHUT_RDWR);  // wakes each client's recv()
    }
    for (auto& t : client_threads_) t.join();
    if (listen_fd_ >= 0) ::close(listen_fd_);
}

std::string KvServer::handle(KvStore& store, const std::string& request) {
    auto sp1 = request.find(' ');
    std::string cmd = request.substr(0, sp1);
    std::string rest = sp1 == std::string::npos ? "" : request.substr(sp1 + 1);
    if (cmd == "SET") {
        auto sp2 = rest.find(' ');
        if (sp2 == std::string::npos || sp2 == 0) return "ERROR unknown command";
        store.set(rest.substr(0, sp2), rest.substr(sp2 + 1));
        return "OK";
    }
    if (cmd == "GET" && !rest.empty() && rest.find(' ') == std::string::npos) {
        auto v = store.get(rest);
        return v ? "VALUE " + *v : "NOT_FOUND";
    }
    if (cmd == "DEL" && !rest.empty() && rest.find(' ') == std::string::npos) return store.del(rest) ? "DELETED" : "NOT_FOUND";
    if (cmd == "COUNT" && sp1 == std::string::npos) return "COUNT " + std::to_string(store.size());
    return "ERROR unknown command";
}

void KvServer::accept_loop() {
    while (!stopping_) {
        int fd = ::accept4(listen_fd_, nullptr, nullptr, SOCK_CLOEXEC);
        if (fd < 0) {
            if (errno == EINTR) continue;
            break;
        }
        std::lock_guard<std::mutex> lock(clients_m_);
        client_fds_.push_back(fd);
        client_threads_.emplace_back([this, fd] { serve_client(fd); });
    }
}

void KvServer::serve_client(int fd) {
    std::string buffer;
    char buf[4096];
    bool open = true;
    while (open) {
        ssize_t n = ::recv(fd, buf, sizeof buf, 0);
        if (n < 0 && errno == EINTR) continue;
        if (n <= 0) break;
        buffer.append(buf, static_cast<std::size_t>(n));
        std::size_t nl;
        while (open && (nl = buffer.find('\n')) != std::string::npos) {
            std::string reply = handle(store_, buffer.substr(0, nl)) + "\n";
            buffer.erase(0, nl + 1);
            if (::send(fd, reply.data(), reply.size(), MSG_NOSIGNAL) != static_cast<ssize_t>(reply.size())) open = false;
        }
    }
    // Close under the lock and mark the slot, so the destructor never touches a
    // descriptor number the OS may already have reused.
    std::lock_guard<std::mutex> lock(clients_m_);
    auto it = std::find(client_fds_.begin(), client_fds_.end(), fd);
    if (it != client_fds_.end()) *it = -1;
    ::close(fd);
}
