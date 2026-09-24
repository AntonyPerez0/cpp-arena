#pragma once

#include <atomic>
#include <mutex>
#include <string>
#include <thread>
#include <vector>

#include "kv_store.h"

// A TCP server on 127.0.0.1 speaking a line protocol. Each request is one line,
// and each gets exactly one reply line:
//
//   SET <key> <value...>   ->  OK                    (the value is the rest of the line)
//   GET <key>              ->  VALUE <value>  or  NOT_FOUND
//   DEL <key>              ->  DELETED        or  NOT_FOUND
//   COUNT                  ->  COUNT <n>
//   anything else          ->  ERROR unknown command
//
// Many clients may be connected at the same time; each can send many requests.
class KvServer {
public:
    // Serves `store` on a free port chosen by the OS. The store must outlive the server.
    explicit KvServer(KvStore& store);
    // Stops accepting, disconnects clients and joins every thread.
    ~KvServer();
    KvServer(const KvServer&) = delete;
    KvServer& operator=(const KvServer&) = delete;

    int port() const { return port_; }

    // The reply (without '\n') for one request line. Pure logic, handy for unit tests.
    static std::string handle(KvStore& store, const std::string& request);

private:
    void accept_loop();
    void serve_client(int fd);

    KvStore& store_;
    int listen_fd_ = -1;
    int port_ = 0;
    std::atomic<bool> stopping_{false};
    std::thread acceptor_;
    std::mutex clients_m_;
    std::vector<int> client_fds_;
    std::vector<std::thread> client_threads_;
};
