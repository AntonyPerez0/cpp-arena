// Runs the server until you press Enter:  ./build/kvserver data.log
// Then, in another terminal:  nc 127.0.0.1 <port>   and type commands.
#include <iostream>

#include "kv_server.h"

int main(int argc, char** argv) {
    KvStore store(argc > 1 ? argv[1] : "kv.log");
    KvServer server(store);
    std::cout << "listening on 127.0.0.1:" << server.port() << " (" << store.size() << " keys). Press Enter to stop.\n";
    std::cin.get();
}
