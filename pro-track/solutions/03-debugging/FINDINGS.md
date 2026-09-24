# Findings

- SEGV in Scoreboard::record_kill: dereferenced the nullptr find_mut returns for an unknown killer; now returns false.
- ASan heap-use-after-free in record_kill: the killer reference dangled after add() grew the vector; look players up after adding.
- ASan heap-buffer-overflow in Scoreboard::top: the copy loop used <= count; changed to <.
- UBSan signed integer overflow in Scoreboard::score: kills * 1000000 overflowed int; widened to long long first.
