// A small program for practicing gdb: build it, then
//   gdb ./build/demo      (run, bt, frame 1, print killer, ...)
#include <iostream>

#include "scoreboard.h"

int main() {
    Scoreboard board;
    board.add("karrigan");
    board.add("ropz");
    board.record_kill("ropz", "s1mple");
    board.record_kill("zywoo", "karrigan");   // zywoo was never added
    for (const auto& name : board.top(3)) std::cout << name << " " << board.score(name) << "\n";
}
