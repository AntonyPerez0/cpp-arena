#include "ledger.h"

// LEDGER_MUTANT selects a deliberately broken version for the grader.
// 0 (the default) is the correct implementation.
#ifndef LEDGER_MUTANT
#define LEDGER_MUTANT 0
#endif

bool Ledger::deposit(long long cents) {
#if LEDGER_MUTANT == 1
    if (cents < 0) return false;
#else
    if (cents <= 0) return false;
#endif
    balance_ += cents;
    transactions_++;
    log_.push_back(cents);
    return true;
}

bool Ledger::withdraw(long long cents) {
#if LEDGER_MUTANT == 2
    if (cents <= 0 || cents >= balance_) return false;
#elif LEDGER_MUTANT == 3
    if (cents > balance_) return false;
#else
    if (cents <= 0 || cents > balance_) return false;
#endif
    balance_ -= cents;
    transactions_++;
    log_.push_back(-cents);
    return true;
}

bool Ledger::apply_interest(int basis_points) {
#if LEDGER_MUTANT == 7
    (void)0;
#else
    if (basis_points < 0) return false;
#endif
#if LEDGER_MUTANT == 4
    long long interest = (balance_ * basis_points + 9999) / 10000;
#else
    long long interest = balance_ * basis_points / 10000;
#endif
    balance_ += interest;
#if LEDGER_MUTANT != 5
    transactions_++;
#endif
    log_.push_back(interest);
    return true;
}

std::vector<long long> Ledger::history(int n) const {
    std::vector<long long> out;
#if LEDGER_MUTANT == 6
    for (std::size_t i = 0; i < log_.size() && static_cast<int>(out.size()) < n; i++) out.push_back(log_[i]);
#else
    for (std::size_t i = log_.size(); i-- > 0 && static_cast<int>(out.size()) < n;) out.push_back(log_[i]);
#endif
    return out;
}
