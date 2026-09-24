# Design

## Threading model
One acceptor thread blocks in accept(). Each client gets its own thread that reads
requests, runs KvServer::handle, and writes one reply line per request. This is
simple and gives every client independent progress, which is why an idle client
never blocks others. It costs one thread (and its stack) per connection, so for
thousands of clients I would switch to a fixed thread pool fed by an epoll loop.

## Locking
KvStore owns a std::shared_mutex. get() and size() take shared locks, so readers
run in parallel; set() and del() take an exclusive lock that covers both the map
update and the log append, so the log order always matches the order changes were
applied. The server's list of client descriptors has its own mutex. Each client
thread closes its own socket under that mutex and marks its slot, so shutdown never
touches a descriptor number that the OS has already reused.

## Durability
Every change is appended to the log as one line and flushed before the call
returns. On startup the log is replayed; a final line without a newline is
treated as a torn write and ignored. fflush only reaches the OS, not the disk, so a
power cut can lose recent writes: calling fsync per write (or per batch) would fix
that at a large latency cost.

## Shutdown
The destructor sets a flag, shuts down the listening socket to wake accept(), joins
the acceptor, then shuts down every client socket to wake blocked recv() calls, and
joins the client threads.

## Next steps
Log compaction (rewrite the log with only live keys when it grows too large),
fsync batching, a thread pool, request size limits, and metrics.
