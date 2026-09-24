#pragma once

#include <atomic>
#include <string>
#include <thread>
#include <vector>

// ---------------------------------------------------------------- part 1: processes
struct RunResult {
    int exit_code = -1;   // the child's exit status, or 128 + signal number if it was killed
    std::string output;   // everything the child wrote to stdout
};

// Runs argv[0] (searched in PATH) with the given arguments, feeding `input` to its
// stdin and capturing its stdout. Returns exit_code 127 if the program can't be started.
RunResult run_capture(const std::vector<std::string>& argv, const std::string& input = "");

// ---------------------------------------------------------------- part 2: files
// Copies src to dst with open/read/write (no stdio, no iostreams), creating or
// truncating dst with permissions 0644. Returns false on any error.
// Must handle short writes and EINTR.
bool copy_file(const std::string& src, const std::string& dst);

// ---------------------------------------------------------------- part 3: sockets
// A TCP server on 127.0.0.1 that answers each line a client sends with the
// same line in UPPERCASE. It serves clients one after another on a background thread.
class EchoServer {
public:
    // Binds to 127.0.0.1 on a free port chosen by the OS, and starts serving.
    EchoServer();
    // Stops accepting, closes the socket and joins the thread.
    ~EchoServer();
    EchoServer(const EchoServer&) = delete;
    EchoServer& operator=(const EchoServer&) = delete;

    int port() const { return port_; }

private:
    void serve();
    int listen_fd_ = -1;
    int port_ = 0;
    std::atomic<bool> stopping_{false};
    std::thread thread_;
};

// Connects to 127.0.0.1:port, sends `line` plus '\n', and returns the reply line
// without its '\n'. Returns "" on any error.
std::string echo_once(int port, const std::string& line);
