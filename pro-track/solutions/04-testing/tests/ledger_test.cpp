#include <gtest/gtest.h>

#include "ledger.h"

TEST(Ledger, DepositIncreasesBalance) {
    Ledger l;
    EXPECT_TRUE(l.deposit(500));
    EXPECT_EQ(l.balance(), 500);
}

TEST(Ledger, DepositRejectsZeroAndNegative) {
    Ledger l;
    EXPECT_FALSE(l.deposit(0));
    EXPECT_FALSE(l.deposit(-5));
    EXPECT_EQ(l.balance(), 0);
    EXPECT_EQ(l.transactions(), 0);
}

TEST(Ledger, WithdrawEntireBalance) {
    Ledger l;
    l.deposit(300);
    EXPECT_TRUE(l.withdraw(300));
    EXPECT_EQ(l.balance(), 0);
}

TEST(Ledger, NoOverdraft) {
    Ledger l;
    l.deposit(300);
    EXPECT_FALSE(l.withdraw(301));
    EXPECT_EQ(l.balance(), 300);
}

TEST(Ledger, WithdrawRejectsZeroAndNegative) {
    Ledger l;
    l.deposit(100);
    EXPECT_FALSE(l.withdraw(0));
    EXPECT_FALSE(l.withdraw(-50));
    EXPECT_EQ(l.balance(), 100);
}

TEST(Ledger, InterestRoundsDown) {
    Ledger l;
    l.deposit(999);
    EXPECT_TRUE(l.apply_interest(100));  // 1% of 999 = 9.99 -> 9
    EXPECT_EQ(l.balance(), 1008);
}

TEST(Ledger, ZeroInterestAddsNothing) {
    Ledger l;
    l.deposit(1000);
    EXPECT_TRUE(l.apply_interest(0));
    EXPECT_EQ(l.balance(), 1000);
}

TEST(Ledger, NegativeInterestRejected) {
    Ledger l;
    l.deposit(1000);
    EXPECT_FALSE(l.apply_interest(-100));
    EXPECT_EQ(l.balance(), 1000);
}

TEST(Ledger, TransactionsCountOnlySuccesses) {
    Ledger l;
    l.deposit(100);
    l.withdraw(500);
    l.apply_interest(1000);
    l.withdraw(10);
    EXPECT_EQ(l.transactions(), 3);
}

TEST(Ledger, HistoryIsNewestFirst) {
    Ledger l;
    l.deposit(100);
    l.withdraw(40);
    l.deposit(7);
    EXPECT_EQ(l.history(2), (std::vector<long long>{7, -40}));
    EXPECT_EQ(l.history(10), (std::vector<long long>{7, -40, 100}));
    EXPECT_TRUE(l.history(0).empty());
}

TEST(Ledger, HistoryIncludesInterest) {
    Ledger l;
    l.deposit(10000);
    l.apply_interest(250);
    EXPECT_EQ(l.history(1), (std::vector<long long>{250}));
}
