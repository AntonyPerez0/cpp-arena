#pragma once

#include <vector>

// A bank-style ledger that stores money as whole cents.
// This is the code under test. Don't change it: the grader checks that it's untouched.
class Ledger {
public:
    // Adds money. Amounts must be positive; returns false (and changes nothing) otherwise.
    bool deposit(long long cents);

    // Removes money if 0 < cents <= balance. No overdrafts. Returns false otherwise.
    bool withdraw(long long cents);

    long long balance() const { return balance_; }

    // Adds interest of basis_points / 10000 of the balance, rounded DOWN to whole cents
    // (100 basis points = 1%). Negative rates are rejected. A rate of 0 succeeds and adds nothing.
    bool apply_interest(int basis_points);

    // How many operations succeeded (failed ones don't count).
    int transactions() const { return transactions_; }

    // The amounts of the last n successful operations, NEWEST first.
    // Deposits and interest are positive, withdrawals negative. Fewer if there aren't n.
    std::vector<long long> history(int n) const;

private:
    long long balance_ = 0;
    int transactions_ = 0;
    std::vector<long long> log_;
};
