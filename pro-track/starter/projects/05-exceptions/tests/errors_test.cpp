#include <gtest/gtest.h>

#include <sstream>

#include "errors.h"

// ---------------------------------------------------------------- part 1
TEST(Config, ParsesPairsAndSkipsComments) {
    std::istringstream in("# server\nport=8080\n\nhost=arena.local\n");
    auto cfg = parse_config(in);
    EXPECT_EQ(cfg.size(), 2u);
    EXPECT_EQ(cfg.at("host"), "arena.local");
}

TEST(Config, MissingEqualsThrowsWithLine) {
    std::istringstream in("a=1\nbroken\n");
    try {
        parse_config(in);
        FAIL() << "expected ConfigError";
    } catch (const ConfigError& e) {
        EXPECT_EQ(e.line(), 2);
        EXPECT_STREQ(e.what(), "line 2: missing =");
    }
}

TEST(Config, EmptyKeyAndDuplicate) {
    std::istringstream a("=5\n");
    EXPECT_THROW(parse_config(a), ConfigError);
    std::istringstream b("x=1\ny=2\nx=3\n");
    try {
        parse_config(b);
        FAIL() << "expected ConfigError";
    } catch (const ConfigError& e) {
        EXPECT_STREQ(e.what(), "line 3: duplicate key x");
    }
}

TEST(Config, ConfigErrorIsARuntimeError) {
    std::istringstream in("oops\n");
    EXPECT_THROW(parse_config(in), std::runtime_error);
}

TEST(Config, GetInt) {
    std::map<std::string, std::string> cfg = {{"port", "8080"}, {"name", "x"}, {"half", "12ab"}};
    EXPECT_EQ(get_int(cfg, "port"), 8080);
    EXPECT_THROW(get_int(cfg, "missing"), std::out_of_range);
    EXPECT_THROW(get_int(cfg, "name"), std::invalid_argument);
    EXPECT_THROW(get_int(cfg, "half"), std::invalid_argument);
    try {
        get_int(cfg, "missing");
    } catch (const std::out_of_range& e) {
        EXPECT_STREQ(e.what(), "missing key missing");
    }
}

// ---------------------------------------------------------------- part 2
TEST(Transfer, MovesMoney) {
    Account a(100), b(5);
    transfer(a, b, 60);
    EXPECT_EQ(a.balance(), 40);
    EXPECT_EQ(b.balance(), 65);
}

TEST(Transfer, InsufficientFundsChangesNothing) {
    Account a(10), b(0);
    EXPECT_THROW(transfer(a, b, 50), InsufficientFunds);
    EXPECT_EQ(a.balance(), 10);
    EXPECT_EQ(b.balance(), 0);
}

TEST(Transfer, FrozenDestinationRollsBack) {
    Account a(100), b(0);
    b.freeze();
    EXPECT_THROW(transfer(a, b, 30), AccountFrozen);
    EXPECT_EQ(a.balance(), 100) << "the money vanished: the withdrawal was not undone";
    EXPECT_EQ(b.balance(), 0);
}

// ---------------------------------------------------------------- part 3
struct Bomb {
    static inline int copies_left = 1000;
    int v;
    explicit Bomb(int x) : v(x) {}
    Bomb(const Bomb& o) : v(o.v) {
        if (--copies_left < 0) throw std::runtime_error("boom");
    }
    Bomb& operator=(const Bomb&) = default;
    Bomb(Bomb&&) noexcept = default;
    Bomb& operator=(Bomb&&) noexcept = default;
};

TEST(AppendAll, AppendsEverything) {
    std::vector<int> dst = {1, 2};
    append_all(dst, std::vector<int>{3, 4});
    EXPECT_EQ(dst, (std::vector<int>{1, 2, 3, 4}));
}

TEST(AppendAll, StrongGuaranteeWhenACopyThrows) {
    std::vector<Bomb> dst;
    dst.reserve(10);
    dst.emplace_back(1);
    dst.emplace_back(2);
    std::vector<Bomb> src;
    src.emplace_back(3);
    src.emplace_back(4);
    src.emplace_back(5);
    Bomb::copies_left = 2;  // the third copy throws
    EXPECT_THROW(append_all(dst, src), std::runtime_error);
    Bomb::copies_left = 1000;
    ASSERT_EQ(dst.size(), 2u) << "dst was left half-appended";
    EXPECT_EQ(dst[0].v, 1);
    EXPECT_EQ(dst[1].v, 2);
}

// ---------------------------------------------------------------- part 4
TEST(Run, Success) {
    std::istringstream in("port=9000\n");
    std::ostringstream out, err;
    EXPECT_EQ(run(in, out, err), 0);
    EXPECT_EQ(out.str(), "port 9000\n");
}

TEST(Run, ConfigErrorBecomesExitCode2) {
    std::istringstream in("port 9000\n");
    std::ostringstream out, err;
    EXPECT_EQ(run(in, out, err), 2);
    EXPECT_EQ(err.str(), "config error: line 1: missing =\n");
}

TEST(Run, OtherErrorsBecomeExitCode1) {
    std::istringstream in("host=x\n");
    std::ostringstream out, err;
    EXPECT_EQ(run(in, out, err), 1);
    EXPECT_EQ(err.str(), "error: missing key port\n");
}
