#pragma once

#include <istream>
#include <map>
#include <ostream>
#include <stdexcept>
#include <string>
#include <vector>

// ---------------------------------------------------------------- part 1: config
// A config error that knows which line it came from.
// what() must read "line <n>: <message>", for example "line 3: missing =".
class ConfigError : public std::runtime_error {
public:
    ConfigError(int line, const std::string& message);
    int line() const noexcept { return line_; }

private:
    int line_;
};

// Parses "key=value" lines. Blank lines and lines starting with '#' are skipped.
// Throws ConfigError for: a line without '=' ("missing ="), an empty key ("empty key"),
// or a repeated key ("duplicate key <key>"). Lines are numbered from 1.
std::map<std::string, std::string> parse_config(std::istream& in);

// Returns cfg[key] as an int.
// Throws std::out_of_range("missing key <key>") if absent, and
// std::invalid_argument("not a number: <key>") unless the whole value is an integer.
int get_int(const std::map<std::string, std::string>& cfg, const std::string& key);

// ---------------------------------------------------------------- part 2: transfers
class InsufficientFunds : public std::runtime_error {
public:
    InsufficientFunds() : std::runtime_error("insufficient funds") {}
};

class AccountFrozen : public std::runtime_error {
public:
    AccountFrozen() : std::runtime_error("account frozen") {}
};

class Account {
public:
    explicit Account(long long balance = 0) : balance_(balance) {}
    long long balance() const { return balance_; }
    void freeze() { frozen_ = true; }
    // Throws InsufficientFunds if amount > balance.
    void withdraw(long long amount) {
        if (amount > balance_) throw InsufficientFunds();
        balance_ -= amount;
    }
    // Throws AccountFrozen if frozen.
    void deposit(long long amount) {
        if (frozen_) throw AccountFrozen();
        balance_ += amount;
    }

private:
    long long balance_;
    bool frozen_ = false;
};

// Moves amount from `from` to `to` with the STRONG guarantee: if anything throws,
// both accounts are exactly as they were, and the exception reaches the caller.
void transfer(Account& from, Account& to, long long amount);

// ---------------------------------------------------------------- part 3: containers
// Appends every element of src to dst with the STRONG guarantee: if copying any
// element throws, dst is left exactly as it was.
template <typename T>
void append_all(std::vector<T>& dst, const std::vector<T>& src);

// ---------------------------------------------------------------- part 4: the boundary
// Plays the role of main(): reads a config from `in` and prints "port <n>" to out.
// It must not let any exception escape. Returns:
//   0 on success,
//   2 on a ConfigError (print "config error: <what()>" to err),
//   1 on any other std::exception (print "error: <what()>" to err).
int run(std::istream& in, std::ostream& out, std::ostream& err);

#include "append_all.tpp"
