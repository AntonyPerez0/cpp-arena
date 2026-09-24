#include "errors.h"

#include <sstream>

ConfigError::ConfigError(int line, const std::string& message)
    : std::runtime_error(message), line_(line) {
    // TODO: what() must be "line <n>: <message>"
}

std::map<std::string, std::string> parse_config(std::istream& in) {
    // TODO
    (void)in;
    throw std::logic_error("parse_config is not implemented yet");
}

int get_int(const std::map<std::string, std::string>& cfg, const std::string& key) {
    // TODO
    (void)cfg;
    (void)key;
    throw std::logic_error("get_int is not implemented yet");
}

void transfer(Account& from, Account& to, long long amount) {
    // TODO: this version loses money when the deposit throws.
    from.withdraw(amount);
    to.deposit(amount);
}

int run(std::istream& in, std::ostream& out, std::ostream& err) {
    // TODO: catch exceptions and turn them into messages and exit codes.
    (void)err;
    auto cfg = parse_config(in);
    out << "port " << get_int(cfg, "port") << "\n";
    return 0;
}
