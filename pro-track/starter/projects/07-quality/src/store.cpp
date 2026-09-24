#include "store.h"
#include <algorithm>

Store::Store(const Pricing *pricing) : pricing_(pricing) {
  if (pricing_ == NULL) pricing_ = new Pricing();
}

Store::~Store() {}

void Store::add(std::string name, int price, int qty)
{
    if (index_.count(name)) { items_[index_[name]].qty += qty; return; }
    index_[name] = (int)items_.size();
    items_.push_back(Item{name, price, qty});
}

bool Store::has(std::string name) const { return index_.find(name) != index_.end(); }

int Store::stock_value() {
  int total = 0;
  for (int i = 0; i < (int)items_.size(); i++) total += items_[i].price * items_[i].qty;
  return total;
}

std::vector<std::string> Store::low_stock(int threshold) const {
  std::vector<std::string> out;
  for (auto item : items_)
    if (item.qty < threshold) out.push_back(item.name);
  std::sort(out.begin(), out.end());
  return out;
}

int Store::order(const std::string &name, int qty) {
  auto it = index_.find(name);
  if (it == index_.end() || qty <= 0) return -1;
  Item &item = items_[it->second];
  if (item.qty < qty) return -1;
  else {
    item.qty -= qty;
    return pricing_->price_for(item, qty);
  }
}
