#pragma once

#include <string>
#include <vector>

struct Player {
    std::string name;
    int kills = 0;
    int deaths = 0;
};

class Scoreboard {
public:
    // Adds a player with no kills or deaths. Adding an existing name does nothing.
    void add(const std::string& name);

    // Records a kill. The killer must already be on the board (otherwise the
    // call is ignored and returns false). An unknown victim is added first.
    bool record_kill(const std::string& killer, const std::string& victim);

    // The player with this name, or nullptr.
    const Player* find(const std::string& name) const;

    // The names of the n players with the most kills, most first
    // (ties in the order they were added). Fewer if there aren't n players.
    std::vector<std::string> top(int n) const;

    // Ranking score: kills * 1,000,000 minus deaths. Needs 64-bit math.
    long long score(const std::string& name) const;

    int size() const { return static_cast<int>(players_.size()); }

private:
    Player* find_mut(const std::string& name);
    std::vector<Player> players_;
};
