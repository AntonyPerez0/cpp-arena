#include "store.h"

#include <gtest/gtest.h>

TEST(Store, AddAndHas) {
    Store s;
    s.add("awp", 4750, 2);
    EXPECT_TRUE(s.has("awp"));
    EXPECT_FALSE(s.has("negev"));
}

TEST(Store, AddingTwiceMergesStock) {
    Store s;
    s.add("vest", 650, 3);
    s.add("vest", 650, 2);
    EXPECT_EQ(s.stock_value(), 650 * 5);
}

TEST(Store, LowStockIsSorted) {
    Store s;
    s.add("smoke", 300, 1);
    s.add("flash", 200, 9);
    s.add("decoy", 50, 0);
    EXPECT_EQ(s.low_stock(2), (std::vector<std::string>{"decoy", "smoke"}));
}

TEST(Store, OrderChargesAndReducesStock) {
    Store s;
    s.add("kit", 400, 5);
    EXPECT_EQ(s.order("kit", 2), 800);
    EXPECT_EQ(s.order("kit", 9), -1);
    EXPECT_EQ(s.order("missing", 1), -1);
    EXPECT_EQ(s.order("kit", 0), -1);
    EXPECT_EQ(s.stock_value(), 400 * 3);
}

TEST(Store, BulkPricing) {
    BulkPricing bulk;
    Store s(&bulk);
    s.add("ammo", 100, 50);
    EXPECT_EQ(s.order("ammo", 10), 900);
    EXPECT_EQ(s.order("ammo", 5), 500);
}
