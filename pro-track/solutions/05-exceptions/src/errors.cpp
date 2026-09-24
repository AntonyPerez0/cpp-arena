#include "errors.h"

#include <charconv>
#include <sstream>

ConfigError::ConfigError(int line, const std::string& message)
    : std::runtime_error("line " + std::to_string(line) + ": " + message), line_(line) {}

std::map<std::string, std::string> parse_config(std::istream& in) {
    std::map<std::string, std::string> cfg;
    std::string line;
    int n = 0;
    while (std::getline(in, line)) {
        n++;
        if (line.empty() || line[0] == '#') continue;
        auto eq = line.find('=');
        if (eq == std::string::npos) throw ConfigError(n, "missing =");
        std::string key = line.substr(0, eq);
        if (key.empty()) throw ConfigError(n, "empty key");
        if (!cfg.emplace(key, line.substr(eq + 1)).second) throw ConfigError(n, "duplicate key " + key);
    }
    return cfg;
}

int get_int(const std::map<std::string, std::string>& cfg, const std::string& key) {
    auto it = cfg.find(key);
    if (it == cfg.end()) throw std::out_of_range("missing key " + key);
    const std::string& s = it->second;
    int v = 0;
    auto [ptr, ec] = std::from_chars(s.data(), s.data() + s.size(), v);
    if (ec != std::errc() || ptr != s.data() + s.size()) throw std::invalid_argument("not a number: " + key);
    return v;
}

void transfer(Account& from, Account& to, long long amount) {
    // Order the steps so the undo can never throw: deposit first, and if the
    // withdrawal fails, take the deposit back out. to.withdraw(amount) can't
    // throw because we just put at least `amount` into `to`.
    to.deposit(amount);
    try {
        from.withdraw(amount);
    } catch (...) {
        to.withdraw(amount);
        throw;  // rethrow the original exception unchanged
    }
}

int run(std::istream& in, std::ostream& out, std::ostream& err) {
    try {
        auto cfg = parse_config(in);
        out << "port " << get_int(cfg, "port") << "\n";
        return 0;
    } catch (const ConfigError& e) {
        err << "config error: " << e.what() << "\n";
        return 2;
    } catch (const std::exception& e) {
        err << "error: " << e.what() << "\n";
        return 1;
    }
}
