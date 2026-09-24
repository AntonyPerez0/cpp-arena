#include "settings.h"

#include <nlohmann/json.hpp>

using nlohmann::json;

namespace {

const json& require(const json& j, const char* key) {
    auto it = j.find(key);
    if (it == j.end()) throw SettingsError(std::string("missing field: ") + key);
    return *it;
}

int require_int(const json& j, const char* key) {
    const json& v = require(j, key);
    if (!v.is_number_integer()) throw SettingsError(std::string("wrong type: ") + key);
    return v.get<int>();
}

}  // namespace

Settings load_settings(const std::string& json_text) {
    json j = json::parse(json_text, nullptr, /*allow_exceptions=*/false);
    if (j.is_discarded() || !j.is_object()) throw SettingsError("invalid JSON");

    Settings s;
    const json& name = require(j, "name");
    if (!name.is_string()) throw SettingsError("wrong type: name");
    s.name = name.get<std::string>();

    s.port = require_int(j, "port");
    if (s.port < 1 || s.port > 65535) throw SettingsError("out of range: port");

    s.max_players = require_int(j, "max_players");
    if (s.max_players < 1 || s.max_players > 64) throw SettingsError("out of range: max_players");

    const json& maps = require(j, "maps");
    if (!maps.is_array()) throw SettingsError("wrong type: maps");
    for (const json& m : maps) {
        if (!m.is_string()) throw SettingsError("wrong type: maps");
        s.maps.push_back(m.get<std::string>());
    }
    if (s.maps.empty()) throw SettingsError("empty maps");

    if (j.contains("tickrate")) s.tickrate = require_int(j, "tickrate");
    return s;
}

std::string to_json(const Settings& s) {
    json j = {
        {"name", s.name}, {"port", s.port}, {"max_players", s.max_players}, {"maps", s.maps}, {"tickrate", s.tickrate},
    };
    return j.dump(2);
}
