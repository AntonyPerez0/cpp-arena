#pragma once
#include <map>
#include <string>
#include <vector>

struct Item { std::string name; int price; int qty; };

class Pricing {
public:
  virtual ~Pricing() = default;
  virtual int price_for(const Item &item, int qty) const { return item.price * qty; }
};

class BulkPricing : public Pricing {
public:
  // 10% off for 10 or more units.
  virtual int price_for(const Item &item, int qty) const {
    int full = item.price * qty;
    if (qty >= 10) return full - full / 10;
    else return full;
  }
};

class Store {
public:
  Store(const Pricing *pricing = NULL);
  ~Store();
  void add(std::string name, int price, int qty);
  bool has(std::string name) const;
  int stock_value();
  std::vector<std::string> low_stock(int threshold) const;
  int order(const std::string &name, int qty);
private:
  const Pricing *pricing_;
  std::vector<Item> items_;
  std::map<std::string, int> index_;
};
