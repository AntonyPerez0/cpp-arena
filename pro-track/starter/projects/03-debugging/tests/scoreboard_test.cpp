#include <gtest/gtest.h>

#include "scoreboard.h"

TEST(Scoreboard, AddIsIdempotent) {
    Scoreboard b;
    b.add("ropz");
    b.add("ropz");
    EXPECT_EQ(b.size(), 1);
}

TEST(Scoreboard, RecordKillUpdatesBothPlayers) {
    Scoreboard b;
    b.add("ropz");
    b.add("rain");
    EXPECT_TRUE(b.record_kill("ropz", "rain"));
    EXPECT_EQ(b.find("ropz")->kills, 1);
    EXPECT_EQ(b.find("rain")->deaths, 1);
}

TEST(Scoreboard, UnknownVictimIsAddedEvenWhenTheBoardGrows) {
    Scoreboard b;
    b.add("killer");
    for (int i = 0; i < 100; i++) EXPECT_TRUE(b.record_kill("killer", "bot" + std::to_string(i)));
    EXPECT_EQ(b.find("killer")->kills, 100);
    EXPECT_EQ(b.size(), 101);
}

TEST(Scoreboard, UnknownKillerIsIgnored) {
    Scoreboard b;
    b.add("rain");
    EXPECT_FALSE(b.record_kill("ghost", "rain"));
    EXPECT_EQ(b.find("rain")->deaths, 0);
}

TEST(Scoreboard, TopOrdersByKills) {
    Scoreboard b;
    for (const char* n : {"a", "b", "c", "d"}) b.add(n);
    b.record_kill("c", "a");
    b.record_kill("c", "b");
    b.record_kill("b", "a");
    EXPECT_EQ(b.top(2), (std::vector<std::string>{"c", "b"}));
    EXPECT_EQ(b.top(10).size(), 4u);
    EXPECT_TRUE(b.top(0).empty());
}

TEST(Scoreboard, ScoreUsesSixtyFourBitMath) {
    Scoreboard b;
    b.add("legend");
    b.add("bot");
    for (int i = 0; i < 5000; i++) b.record_kill("legend", "bot");
    EXPECT_EQ(b.score("legend"), 5000LL * 1000000);
    EXPECT_EQ(b.score("bot"), -5000);
    EXPECT_EQ(b.score("nobody"), 0);
}
