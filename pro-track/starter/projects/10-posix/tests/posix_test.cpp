#include <gtest/gtest.h>

#include <fstream>
#include <sstream>

#include "posix.h"

static std::string slurp(const std::string& path) {
    std::ifstream in(path, std::ios::binary);
    std::ostringstream all;
    all << in.rdbuf();
    return all.str();
}

TEST(RunCapture, CapturesStdout) {
    RunResult r = run_capture({"echo", "gg", "wp"});
    EXPECT_EQ(r.exit_code, 0);
    EXPECT_EQ(r.output, "gg wp\n");
}

TEST(RunCapture, FeedsStdin) {
    RunResult r = run_capture({"sort"}, "nuke\ndust2\nmirage\n");
    EXPECT_EQ(r.output, "dust2\nmirage\nnuke\n");
}

TEST(RunCapture, ReportsExitCodes) {
    EXPECT_EQ(run_capture({"sh", "-c", "exit 3"}).exit_code, 3);
    EXPECT_EQ(run_capture({"false"}).exit_code, 1);
}

TEST(RunCapture, ReportsSignals) {
    EXPECT_EQ(run_capture({"sh", "-c", "kill -9 $$"}).exit_code, 128 + 9);
}

TEST(RunCapture, MissingProgramIs127) {
    EXPECT_EQ(run_capture({"definitely-not-a-real-program-xyz"}).exit_code, 127);
}

TEST(CopyFile, CopiesBytesExactly) {
    std::string data;
    for (int i = 0; i < 200000; i++) data += static_cast<char>(i % 251);
    {
        std::ofstream out("copy_src.bin", std::ios::binary);
        out << data;
    }
    ASSERT_TRUE(copy_file("copy_src.bin", "copy_dst.bin"));
    EXPECT_EQ(slurp("copy_dst.bin"), data);
    ASSERT_TRUE(copy_file("copy_src.bin", "copy_dst.bin"));  // truncates, not appends
    EXPECT_EQ(slurp("copy_dst.bin").size(), data.size());
}

TEST(CopyFile, FailsCleanly) {
    EXPECT_FALSE(copy_file("no-such-file.bin", "out.bin"));
    EXPECT_FALSE(copy_file("copy_src.bin", "no/such/dir/out.bin"));
}

TEST(Echo, UppercasesLines) {
    EchoServer server;
    ASSERT_GT(server.port(), 0);
    EXPECT_EQ(echo_once(server.port(), "rush b"), "RUSH B");
    EXPECT_EQ(echo_once(server.port(), "no stop"), "NO STOP");
}

TEST(Echo, ManyClientsInARow) {
    EchoServer server;
    for (int i = 0; i < 50; i++) EXPECT_EQ(echo_once(server.port(), "round " + std::to_string(i)), "ROUND " + std::to_string(i));
}

TEST(Echo, NoServerMeansEmptyReply) {
    int port;
    {
        EchoServer server;
        port = server.port();
    }
    EXPECT_EQ(echo_once(port, "hello?"), "");
}
