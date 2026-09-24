# 04 · Unit testing with GoogleTest

On the Arena site the tests were written for you. At work, **you** write them: every change ships with tests, and code review asks "where's the test?" In this project you write a test suite for a small ledger class, and the grader checks whether your tests are actually good.

**How it's graded: mutation testing.** Coverage only tells you a line *ran*, not that a test would notice if it were wrong. So the grader builds 7 **mutants**, copies of the ledger with one small, realistic bug each (an off-by-one, a flipped sign, the wrong rounding...). Your tests must pass on the real ledger and **fail on every mutant**. A mutant that survives means some rule in the spec has no test.

**You'll practice:** GoogleTest, EXPECT vs ASSERT, test structure, edge cases, and thinking like a tester.

## Background

### A GoogleTest test

```cpp
#include <gtest/gtest.h>
#include "ledger.h"

TEST(Ledger, WithdrawRejectsOverdraft) {   // TEST(SuiteName, TestName)
    Ledger l;                              // Arrange
    l.deposit(300);
    bool ok = l.withdraw(301);             // Act
    EXPECT_FALSE(ok);                      // Assert
    EXPECT_EQ(l.balance(), 300);
}
```

| Macro | Checks |
|---|---|
| `EXPECT_TRUE(x)` / `EXPECT_FALSE(x)` | a condition |
| `EXPECT_EQ(a, b)`, `EXPECT_NE`, `EXPECT_LT`, `EXPECT_GE`... | comparisons (with both values printed on failure) |
| `EXPECT_DOUBLE_EQ(a, b)` | doubles, allowing tiny rounding differences |
| `EXPECT_STREQ(a, b)` | C strings by content |
| `ASSERT_...` | same, but **stops the test** on failure. Use it when continuing makes no sense (for example before dereferencing a pointer you just checked). |

### What makes a good test

- **One behavior per test**, named after the behavior: `DepositRejectsZero`, not `Test2`.
- **Arrange, act, assert**: set up, do one thing, check the result *and* the side effects (did the balance stay unchanged after a rejected withdrawal?).
- **Edge cases are where bugs live**: zero, negative, one, exactly the limit, one past the limit, empty, rounding.
- Tests must be **deterministic** and **independent**: no shared state between tests, no reliance on order or timing.

A useful habit: read the spec one sentence at a time and ask, "which test would fail if this sentence were violated?"

### Running tests

```bash
cmake -S . -B build -G Ninja && cmake --build build
ctest --test-dir build --output-on-failure          # all tests
./build/ledger_test --gtest_filter='Ledger.Deposit*'   # just some
```

## Your tasks

1. Read `src/ledger.h` carefully. Every comment is a rule.
2. Write tests in `tests/ledger_test.cpp` until you believe every rule is covered: at least 10 `TEST`s.
3. Grade: `bash ../../tools/grade.sh 04-testing`. Each surviving mutant tells you which rule is untested. Add tests until all 7 die.
4. Don't edit `src/`: the grader checks the ledger is unchanged.
5. Commit and push.

## Done when

- your tests pass on the real ledger,
- there are at least 10 tests,
- all 7 mutants are killed.

## Hints

- Rejected operations should change **nothing**: check the balance and the transaction count afterwards.
- "Rounded down" is only observable when the exact interest has a fraction. Pick numbers that make it one.
- "Newest first" needs at least two different entries to be observable.
- If a mutant survives and you can't see why, read `src/ledger.cpp`: the `#if LEDGER_MUTANT == k` blocks show exactly what each mutant changes. (In real mutation testing tools you'd see the same kind of diff.)

## Stretch goals

- Use a **test fixture** (`class LedgerTest : public ::testing::Test`) to share setup between tests.
- Try **parameterized tests** (`TEST_P` with `INSTANTIATE_TEST_SUITE_P`) for the interest rounding cases.
- Write the tests for a new feature *before* the feature (test-driven development): add a `transfer(Ledger& to, long long cents)` spec, tests, then the code.
