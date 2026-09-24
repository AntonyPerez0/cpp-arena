#pragma once
#include <map>
#include <memory>
#include <string>
#include <vector>

struct Item {
    std::string name;
    int price;
    int qty;
};

class Pricing {
   public:
    Pricing() = default;
    Pricing(const Pricing&) = default;
    Pricing& operator=(const Pricing&) = default;
    Pricing(Pricing&&) = default;
    Pricing& operator=(Pricing&&) = default;
    virtual ~Pricing() = default;
    virtual int price_for(const Item& item, int qty) const { return item.price * qty; }
};

class BulkPricing : public Pricing {
   public:
    // 10% off for 10 or more units.
    int price_for(const Item& item, int qty) const override {
        int full = item.price * qty;
        if (qty >= 10) {
            return full - full / 10;
        }
        return full;
    }
};

class Store {
   public:
    // Uses the given pricing (not owned), or standard pricing if none is given.
    explicit Store(const Pricing* pricing = nullptr);
    void add(const std::string& name, int price, int qty);
    bool has(const std::string& name) const;
    int stock_value() const;
    std::vector<std::string> low_stock(int threshold) const;
    int order(const std::string& name, int qty);

   private:
    Pricing standard_;
    const Pricing* pricing_;
    std::vector<Item> items_;
    std::map<std::string, std::size_t> index_;
};
