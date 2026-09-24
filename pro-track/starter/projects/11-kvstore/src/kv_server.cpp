#include "kv_server.h"

// TODO: implement handle() first (unit-testable without sockets), then the
// networking: listen on 127.0.0.1 port 0, accept clients on acceptor_, and serve
// each client on its own thread. Project 10's EchoServer is a good starting point.

KvServer::KvServer(KvStore& store) : store_(store) {}

KvServer::~KvServer() {}

std::string KvServer::handle(KvStore& store, const std::string& request) {
    (void)store;
    (void)request;
    return "ERROR unknown command";
}

void KvServer::accept_loop() {}

void KvServer::serve_client(int fd) { (void)fd; }
