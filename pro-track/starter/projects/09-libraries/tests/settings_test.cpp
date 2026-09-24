#include <gtest/gtest.h>

#include "settings.h"

static const char* kGood = R"({
  "name": "arena-eu-1",
  "port": 27015,
  "max_players": 10,
  "maps": ["de_dust2", "de_nuke"],
  "tickrate": 128
})";

static std::string error_of(const std::string& text) {
    try {
        load_settings(text);
    } catch (const SettingsError& e) {
        return e.what();
    }
    return "(no error)";
}

TEST(Settings, LoadsEveryField) {
    Settings s = load_settings(kGood);
    EXPECT_EQ(s.name, "arena-eu-1");
    EXPECT_EQ(s.port, 27015);
    EXPECT_EQ(s.max_players, 10);
    EXPECT_EQ(s.maps, (std::vector<std::string>{"de_dust2", "de_nuke"}));
    EXPECT_EQ(s.tickrate, 128);
}

TEST(Settings, TickrateDefaultsTo64) {
    Settings s = load_settings(R"({"name":"x","port":1,"max_players":2,"maps":["m"]})");
    EXPECT_EQ(s.tickrate, 64);
}

TEST(Settings, ReportsProblemsClearly) {
    EXPECT_EQ(error_of("{not json"), "invalid JSON");
    EXPECT_EQ(error_of("[1, 2]"), "invalid JSON");
    EXPECT_EQ(error_of(R"({"port":1,"max_players":2,"maps":["m"]})"), "missing field: name");
    EXPECT_EQ(error_of(R"({"name":"x","port":"27015","max_players":2,"maps":["m"]})"), "wrong type: port");
    EXPECT_EQ(error_of(R"({"name":"x","port":1,"max_players":2,"maps":["m", 3]})"), "wrong type: maps");
    EXPECT_EQ(error_of(R"({"name":"x","port":70000,"max_players":2,"maps":["m"]})"), "out of range: port");
    EXPECT_EQ(error_of(R"({"name":"x","port":1,"max_players":0,"maps":["m"]})"), "out of range: max_players");
    EXPECT_EQ(error_of(R"({"name":"x","port":1,"max_players":2,"maps":[]})"), "empty maps");
    EXPECT_EQ(error_of(R"({"name":"x","port":1,"max_players":2,"maps":["m"],"tickrate":"fast"})"), "wrong type: tickrate");
}

TEST(Settings, RoundTrips) {
    Settings s = load_settings(kGood);
    Settings again = load_settings(to_json(s));
    EXPECT_EQ(again.name, s.name);
    EXPECT_EQ(again.port, s.port);
    EXPECT_EQ(again.max_players, s.max_players);
    EXPECT_EQ(again.maps, s.maps);
    EXPECT_EQ(again.tickrate, s.tickrate);
}
