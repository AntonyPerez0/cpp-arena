#pragma once

#include <stdexcept>
#include <string>
#include <vector>

// Server settings, loaded from JSON like:
// {
//   "name": "arena-eu-1",
//   "port": 27015,
//   "max_players": 10,
//   "maps": ["de_dust2", "de_nuke"],
//   "tickrate": 128          <- optional, defaults to 64
// }
struct Settings {
    std::string name;
    int port = 0;
    int max_players = 0;
    std::vector<std::string> maps;
    int tickrate = 64;
};

// Thrown for any problem, with a message a human can act on:
//   "invalid JSON"                        text isn't valid JSON (or isn't an object)
//   "missing field: <name>"               a required field is absent
//   "wrong type: <name>"                  present but the wrong JSON type
//   "out of range: port"                  port must be 1..65535
//   "out of range: max_players"           max_players must be 1..64
//   "empty maps"                          at least one map is required
class SettingsError : public std::runtime_error {
public:
    using std::runtime_error::runtime_error;
};

Settings load_settings(const std::string& json_text);

// Serializes back to JSON (always including tickrate). load_settings(to_json(s)) == s.
std::string to_json(const Settings& s);
