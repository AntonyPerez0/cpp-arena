#include "posix.h"

#include <arpa/inet.h>
#include <fcntl.h>
#include <netinet/in.h>
#include <signal.h>
#include <sys/socket.h>
#include <sys/wait.h>
#include <unistd.h>

#include <cctype>
#include <cerrno>
#include <cstring>

namespace {

// Writes all of buf, retrying on short writes and EINTR.
bool write_all(int fd, const char* buf, std::size_t len) {
    while (len > 0) {
        ssize_t n = ::write(fd, buf, len);
        if (n < 0) {
            if (errno == EINTR) continue;
            return false;
        }
        buf += n;
        len -= static_cast<std::size_t>(n);
    }
    return true;
}

// Retries read() when a signal interrupts it.
ssize_t read_some(int fd, char* buf, std::size_t len) {
    ssize_t n;
    do {
        n = ::read(fd, buf, len);
    } while (n < 0 && errno == EINTR);
    return n;
}

}  // namespace

RunResult run_capture(const std::vector<std::string>& argv, const std::string& input) {
    RunResult result;
    if (argv.empty()) return result;
    // A child that exits without reading its stdin would otherwise kill us with SIGPIPE.
    ::signal(SIGPIPE, SIG_IGN);

    // Build argv before fork: between fork and exec the child may only call
    // async-signal-safe functions, so no allocation there.
    std::vector<char*> args;
    for (const auto& a : argv) args.push_back(const_cast<char*>(a.c_str()));
    args.push_back(nullptr);

    int in_pipe[2], out_pipe[2];
    if (::pipe(in_pipe) != 0) return result;
    if (::pipe(out_pipe) != 0) {
        ::close(in_pipe[0]);
        ::close(in_pipe[1]);
        return result;
    }

    pid_t pid = ::fork();
    if (pid < 0) {
        for (int fd : {in_pipe[0], in_pipe[1], out_pipe[0], out_pipe[1]}) ::close(fd);
        return result;
    }
    if (pid == 0) {  // child
        ::dup2(in_pipe[0], STDIN_FILENO);
        ::dup2(out_pipe[1], STDOUT_FILENO);
        for (int fd : {in_pipe[0], in_pipe[1], out_pipe[0], out_pipe[1]}) ::close(fd);
        ::execvp(args[0], args.data());
        ::_exit(127);  // exec failed
    }

    // parent
    ::close(in_pipe[0]);
    ::close(out_pipe[1]);
    // Write the input on another thread: if the child produces lots of output before
    // reading all its input, writing and reading on one thread could deadlock.
    std::thread writer([fd = in_pipe[1], &input] {
        write_all(fd, input.data(), input.size());
        ::close(fd);  // EOF for the child's stdin
    });
    char buf[4096];
    ssize_t n;
    while ((n = read_some(out_pipe[0], buf, sizeof buf)) > 0) result.output.append(buf, static_cast<std::size_t>(n));
    ::close(out_pipe[0]);
    writer.join();

    int status = 0;
    while (::waitpid(pid, &status, 0) < 0 && errno == EINTR) {
    }
    if (WIFEXITED(status)) result.exit_code = WEXITSTATUS(status);
    else if (WIFSIGNALED(status)) result.exit_code = 128 + WTERMSIG(status);
    return result;
}

bool copy_file(const std::string& src, const std::string& dst) {
    int in = ::open(src.c_str(), O_RDONLY | O_CLOEXEC);
    if (in < 0) return false;
    int out = ::open(dst.c_str(), O_WRONLY | O_CREAT | O_TRUNC | O_CLOEXEC, 0644);
    if (out < 0) {
        ::close(in);
        return false;
    }
    bool ok = true;
    char buf[64 * 1024];
    while (true) {
        ssize_t n = read_some(in, buf, sizeof buf);
        if (n == 0) break;
        if (n < 0 || !write_all(out, buf, static_cast<std::size_t>(n))) {
            ok = false;
            break;
        }
    }
    ::close(in);
    if (::close(out) != 0) ok = false;  // close can report a delayed write error
    return ok;
}

EchoServer::EchoServer() {
    listen_fd_ = ::socket(AF_INET, SOCK_STREAM | SOCK_CLOEXEC, 0);
    if (listen_fd_ < 0) return;
    int yes = 1;
    ::setsockopt(listen_fd_, SOL_SOCKET, SO_REUSEADDR, &yes, sizeof yes);
    sockaddr_in addr{};
    addr.sin_family = AF_INET;
    addr.sin_addr.s_addr = htonl(INADDR_LOOPBACK);
    addr.sin_port = 0;  // let the OS choose a free port
    if (::bind(listen_fd_, reinterpret_cast<sockaddr*>(&addr), sizeof addr) != 0 || ::listen(listen_fd_, 16) != 0) {
        ::close(listen_fd_);
        listen_fd_ = -1;
        return;
    }
    socklen_t len = sizeof addr;
    ::getsockname(listen_fd_, reinterpret_cast<sockaddr*>(&addr), &len);
    port_ = ntohs(addr.sin_port);
    thread_ = std::thread([this] { serve(); });
}

EchoServer::~EchoServer() {
    stopping_ = true;
    if (listen_fd_ >= 0) ::shutdown(listen_fd_, SHUT_RDWR);  // wakes the blocked accept()
    if (thread_.joinable()) thread_.join();
    if (listen_fd_ >= 0) ::close(listen_fd_);
}

void EchoServer::serve() {
    while (!stopping_) {
        int client = ::accept(listen_fd_, nullptr, nullptr);
        if (client < 0) {
            if (errno == EINTR) continue;
            break;  // shut down
        }
        std::string pending;
        char buf[1024];
        ssize_t n;
        while ((n = read_some(client, buf, sizeof buf)) > 0) {
            pending.append(buf, static_cast<std::size_t>(n));
            std::size_t nl;
            while ((nl = pending.find('\n')) != std::string::npos) {
                std::string line = pending.substr(0, nl + 1);
                pending.erase(0, nl + 1);
                for (char& c : line) c = static_cast<char>(std::toupper(static_cast<unsigned char>(c)));
                if (::send(client, line.data(), line.size(), MSG_NOSIGNAL) < 0) break;
            }
        }
        ::close(client);
    }
}

std::string echo_once(int port, const std::string& line) {
    int fd = ::socket(AF_INET, SOCK_STREAM | SOCK_CLOEXEC, 0);
    if (fd < 0) return "";
    sockaddr_in addr{};
    addr.sin_family = AF_INET;
    addr.sin_addr.s_addr = htonl(INADDR_LOOPBACK);
    addr.sin_port = htons(static_cast<uint16_t>(port));
    std::string reply;
    if (::connect(fd, reinterpret_cast<sockaddr*>(&addr), sizeof addr) == 0) {
        std::string msg = line + "\n";
        if (::send(fd, msg.data(), msg.size(), MSG_NOSIGNAL) == static_cast<ssize_t>(msg.size())) {
            char c;
            while (read_some(fd, &c, 1) == 1 && c != '\n') reply += c;
        }
    }
    ::close(fd);
    return reply;
}
