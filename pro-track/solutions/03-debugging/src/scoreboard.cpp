#include "scoreboard.h"

#include <algorithm>

void Scoreboard::add(const std::string& name) {
    if (find(name) == nullptr) players_.push_back(Player{name, 0, 0});
}

Player* Scoreboard::find_mut(const std::string& name) {
    for (auto& p : players_)
        if (p.name == name) return &p;
    return nullptr;
}

const Player* Scoreboard::find(const std::string& name) const {
    for (const auto& p : players_)
        if (p.name == name) return &p;
    return nullptr;
}

bool Scoreboard::record_kill(const std::string& killer, const std::string& victim) {
    if (find(killer) == nullptr) return false;
    add(victim);  // may reallocate players_, so look both up afterwards
    Player* k = find_mut(killer);
    Player* v = find_mut(victim);
    k->kills++;
    v->deaths++;
    return true;
}

std::vector<std::string> Scoreboard::top(int n) const {
    std::vector<const Player*> order;
    for (const auto& p : players_) order.push_back(&p);
    std::stable_sort(order.begin(), order.end(), [](const Player* a, const Player* b) { return a->kills > b->kills; });
    int count = std::max(0, std::min(n, static_cast<int>(order.size())));
    std::vector<std::string> out(count);
    for (int i = 0; i < count; i++) out[i] = order[i]->name;
    return out;
}

long long Scoreboard::score(const std::string& name) const {
    const Player* p = find(name);
    if (p == nullptr) return 0;
    return static_cast<long long>(p->kills) * 1000000 - p->deaths;
}
