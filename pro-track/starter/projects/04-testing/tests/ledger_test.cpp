#include <gtest/gtest.h>

#include "ledger.h"

// One example to copy. Write many more: every rule in ledger.h needs tests,
// including the edge cases (zero, negative, exactly the balance, rounding...).

TEST(Ledger, DepositIncreasesBalance) {
    Ledger l;
    EXPECT_TRUE(l.deposit(500));
    EXPECT_EQ(l.balance(), 500);
}
