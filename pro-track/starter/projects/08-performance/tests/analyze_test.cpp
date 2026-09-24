#include <gtest/gtest.h>

#include <chrono>

#include "analyze.h"
#include "generate.h"

TEST(Analyze, SmallLog) {
    std::vector<std::string> log = {
        "1 ropz buy 10", "2 rain buy 30", "3 ropz sell 50", "4 broken", "5 rain chat x", "6 ropz chat 20",
    };
    Report r = analyze(log);
    EXPECT_EQ(r.lines, 4u);
    EXPECT_EQ(r.unique_users, 2u);
    EXPECT_EQ(r.busiest_user, "ropz");
    EXPECT_EQ(r.p95_latency, 50);
    EXPECT_EQ(r.slowest_action, "sell");
}

TEST(Analyze, TiesAreAlphabetical) {
    Report r = analyze({"1 zed a 5", "2 amy b 5", "3 zed b 5", "4 amy a 5"});
    EXPECT_EQ(r.busiest_user, "amy");
    EXPECT_EQ(r.slowest_action, "a");
}

TEST(Analyze, NearestRankPercentile) {
    std::vector<std::string> log;
    for (int i = 1; i <= 20; i++) log.push_back("1 u a " + std::to_string(i * 10));
    EXPECT_EQ(analyze(log).p95_latency, 190);
}

TEST(Analyze, RejectsExtraFieldsAndBigNumbers) {
    Report r = analyze({"1 u a 5 extra", "1 u a 99999999999", "1 u a 7"});
    EXPECT_EQ(r.lines, 1u);
    EXPECT_EQ(r.p95_latency, 7);
}

TEST(Analyze, EmptyLog) {
    Report r = analyze({});
    EXPECT_EQ(r.lines, 0u);
    EXPECT_EQ(r.busiest_user, "");
}

// Reference values for the generated log (the slow version agrees on smaller logs).
TEST(Analyze, LargeLogIsCorrectAndFast) {
    auto log = generate_log(300000);
    auto start = std::chrono::steady_clock::now();
    Report r = analyze(log);
    auto ms = std::chrono::duration_cast<std::chrono::milliseconds>(std::chrono::steady_clock::now() - start).count();
    EXPECT_EQ(r.lines, 299700u);
    EXPECT_EQ(r.unique_users, 59612u);
    EXPECT_EQ(r.busiest_user, "user41708");
    EXPECT_EQ(r.p95_latency, 1934);
    EXPECT_EQ(r.slowest_action, "logout");
    std::cout << "analyze(300000 lines) took " << ms << " ms\n";
    EXPECT_LT(ms, 1500) << "too slow: the budget is 1500 ms in a Release build";
}
