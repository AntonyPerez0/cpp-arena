#include "settings.h"

// TODO: include <nlohmann/json.hpp> once CMake provides the library,
// then implement both functions with it.

Settings load_settings(const std::string& json_text) {
    (void)json_text;
    throw SettingsError("load_settings is not implemented yet");
}

std::string to_json(const Settings& s) {
    (void)s;
    return "{}";
}
