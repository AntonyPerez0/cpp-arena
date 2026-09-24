#include "store.h"

#include <algorithm>

Store::Store(const Pricing* pricing) : pricing_(pricing != nullptr ? pricing : &standard_) {}

void Store::add(const std::string& name, int price, int qty) {
    auto it = index_.find(name);
    if (it != index_.end()) {
        items_[it->second].qty += qty;
        return;
    }
    index_[name] = items_.size();
    items_.push_back(Item{name, price, qty});
}

bool Store::has(const std::string& name) const {
    return index_.find(name) != index_.end();
}

int Store::stock_value() const {
    int total = 0;
    for (const auto& item : items_) {
        total += item.price * item.qty;
    }
    return total;
}

std::vector<std::string> Store::low_stock(int threshold) const {
    std::vector<std::string> out;
    for (const auto& item : items_) {
        if (item.qty < threshold) {
            out.push_back(item.name);
        }
    }
    std::sort(out.begin(), out.end());
    return out;
}

int Store::order(const std::string& name, int qty) {
    auto it = index_.find(name);
    if (it == index_.end() || qty <= 0) {
        return -1;
    }
    Item& item = items_[it->second];
    if (item.qty < qty) {
        return -1;
    }
    item.qty -= qty;
    return pricing_->price_for(item, qty);
}
