#include "posix.h"

#include <arpa/inet.h>
#include <fcntl.h>
#include <netinet/in.h>
#include <sys/socket.h>
#include <sys/wait.h>
#include <unistd.h>

#include <cerrno>
#include <cstring>

RunResult run_capture(const std::vector<std::string>& argv, const std::string& input) {
    // TODO: pipe() x2, fork(), in the child dup2 + execvp, in the parent write the
    // input, read the output until EOF, then waitpid() and decode the status.
    (void)argv;
    (void)input;
    return {};
}

bool copy_file(const std::string& src, const std::string& dst) {
    // TODO: open, loop read/write (handling short writes and EINTR), close both.
    (void)src;
    (void)dst;
    return false;
}

EchoServer::EchoServer() {
    // TODO: socket, setsockopt(SO_REUSEADDR), bind to 127.0.0.1 port 0, listen,
    // getsockname to learn the port, then start thread_ running serve().
}

EchoServer::~EchoServer() {
    // TODO: stop the server cleanly.
}

void EchoServer::serve() {
    // TODO: accept clients until stopping_; for each, read lines and reply in uppercase.
}

std::string echo_once(int port, const std::string& line) {
    // TODO: socket, connect, send the line and '\n', read until '\n'.
    (void)port;
    (void)line;
    return "";
}
