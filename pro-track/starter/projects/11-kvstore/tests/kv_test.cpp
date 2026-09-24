#include <gtest/gtest.h>

#include <cstdio>
#include <thread>

#include "kv_client.h"
#include "kv_server.h"

// ---------------------------------------------------------------- store
TEST(Store, SetGetDel) {
    KvStore s;
    EXPECT_EQ(s.get("map"), std::nullopt);
    s.set("map", "de_dust2");
    EXPECT_EQ(s.get("map"), "de_dust2");
    s.set("map", "de_nuke");
    EXPECT_EQ(s.get("map"), "de_nuke");
    EXPECT_EQ(s.size(), 1u);
    EXPECT_TRUE(s.del("map"));
    EXPECT_FALSE(s.del("map"));
    EXPECT_EQ(s.size(), 0u);
}

TEST(Store, SurvivesRestart) {
    std::remove("kv_test.log");
    {
        KvStore s("kv_test.log");
        s.set("a", "1");
        s.set("b", "two words");
        s.set("a", "3");
        s.del("b");
        s.set("c", "x");
    }
    KvStore again("kv_test.log");
    EXPECT_EQ(again.get("a"), "3");
    EXPECT_EQ(again.get("b"), std::nullopt);
    EXPECT_EQ(again.get("c"), "x");
    EXPECT_EQ(again.size(), 2u);
    std::remove("kv_test.log");
}

TEST(Store, ValuesKeepSpaces) {
    std::remove("kv_spaces.log");
    {
        KvStore s("kv_spaces.log");
        s.set("motd", "gl hf  everyone");
    }
    KvStore again("kv_spaces.log");
    EXPECT_EQ(again.get("motd"), "gl hf  everyone");
    std::remove("kv_spaces.log");
}

TEST(Store, ConcurrentWriters) {
    KvStore s;
    std::vector<std::thread> ts;
    for (int t = 0; t < 8; t++)
        ts.emplace_back([&s, t] {
            for (int i = 0; i < 500; i++) {
                s.set("k" + std::to_string(t) + "_" + std::to_string(i), "v");
                s.get("k0_0");
            }
        });
    for (auto& t : ts) t.join();
    EXPECT_EQ(s.size(), 4000u);
}

// ---------------------------------------------------------------- protocol
TEST(Protocol, Commands) {
    KvStore s;
    EXPECT_EQ(KvServer::handle(s, "GET x"), "NOT_FOUND");
    EXPECT_EQ(KvServer::handle(s, "SET x hello world"), "OK");
    EXPECT_EQ(KvServer::handle(s, "GET x"), "VALUE hello world");
    EXPECT_EQ(KvServer::handle(s, "COUNT"), "COUNT 1");
    EXPECT_EQ(KvServer::handle(s, "DEL x"), "DELETED");
    EXPECT_EQ(KvServer::handle(s, "DEL x"), "NOT_FOUND");
    EXPECT_EQ(KvServer::handle(s, "FLY away"), "ERROR unknown command");
    EXPECT_EQ(KvServer::handle(s, "SET onlykey"), "ERROR unknown command");
    EXPECT_EQ(KvServer::handle(s, ""), "ERROR unknown command");
}

// ---------------------------------------------------------------- server
TEST(Server, OneClient) {
    KvStore s;
    KvServer server(s);
    KvClient c(server.port());
    ASSERT_TRUE(c.connected());
    EXPECT_EQ(c.request("SET round 16"), "OK");
    EXPECT_EQ(c.request("GET round"), "VALUE 16");
    EXPECT_EQ(c.request("COUNT"), "COUNT 1");
}

TEST(Server, ClientsAtTheSameTime) {
    KvStore s;
    KvServer server(s);
    KvClient idle(server.port());  // stays connected: the server must still serve others
    ASSERT_TRUE(idle.connected());
    std::vector<std::thread> ts;
    std::atomic<int> ok{0};
    for (int t = 0; t < 8; t++)
        ts.emplace_back([&, t] {
            KvClient c(server.port());
            for (int i = 0; i < 200; i++) {
                std::string key = "p" + std::to_string(t) + "_" + std::to_string(i);
                if (c.request("SET " + key + " " + std::to_string(i)) == "OK" &&
                    c.request("GET " + key) == "VALUE " + std::to_string(i))
                    ok++;
            }
        });
    for (auto& t : ts) t.join();
    EXPECT_EQ(ok.load(), 1600);
    EXPECT_EQ(idle.request("COUNT"), "COUNT 1600");
}

TEST(Server, StopsWithClientsConnected) {
    KvStore s;
    auto server = std::make_unique<KvServer>(s);
    KvClient c(server->port());
    EXPECT_EQ(c.request("SET a b"), "OK");
    server.reset();  // must not hang even though c is still connected
    EXPECT_EQ(c.request("GET a"), "");
}
