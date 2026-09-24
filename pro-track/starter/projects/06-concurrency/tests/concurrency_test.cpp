#include <gtest/gtest.h>

#include <atomic>
#include <chrono>
#include <numeric>

#include "concurrency.h"

TEST(BlockingQueue, FifoOrder) {
    BlockingQueue<int> q;
    q.push(1);
    q.push(2);
    EXPECT_EQ(q.pop(), 1);
    EXPECT_EQ(q.pop(), 2);
}

TEST(BlockingQueue, PopWaitsForAProducer) {
    BlockingQueue<int> q;
    std::thread producer([&] {
        std::this_thread::sleep_for(std::chrono::milliseconds(50));
        q.push(42);
    });
    EXPECT_EQ(q.pop(), 42);  // must block, not return nullopt
    producer.join();
}

TEST(BlockingQueue, CloseWakesWaitersAndRejectsPushes) {
    BlockingQueue<int> q;
    std::thread consumer([&] { EXPECT_EQ(q.pop(), std::nullopt); });
    std::this_thread::sleep_for(std::chrono::milliseconds(50));
    q.close();
    consumer.join();
    EXPECT_FALSE(q.push(1));
}

TEST(BlockingQueue, DrainsBeforeReportingClosed) {
    BlockingQueue<int> q;
    q.push(7);
    q.close();
    EXPECT_EQ(q.pop(), 7);
    EXPECT_EQ(q.pop(), std::nullopt);
}

TEST(BlockingQueue, ManyProducersAndConsumers) {
    BlockingQueue<int> q;
    std::atomic<long> sum{0};
    std::vector<std::thread> consumers;
    for (int c = 0; c < 4; c++)
        consumers.emplace_back([&] {
            while (auto v = q.pop()) sum += *v;
        });
    std::vector<std::thread> producers;
    for (int p = 0; p < 4; p++)
        producers.emplace_back([&, p] {
            for (int i = 1; i <= 1000; i++) q.push(p * 1000 + i);
        });
    for (auto& t : producers) t.join();
    q.close();
    for (auto& t : consumers) t.join();
    long expected = 0;
    for (int v = 1; v <= 4000; v++) expected += v;
    EXPECT_EQ(sum.load(), expected);
}

TEST(ThreadPool, RunsJobsAndReturnsResults) {
    ThreadPool pool(4);
    std::vector<std::future<int>> results;
    for (int i = 0; i < 100; i++) results.push_back(pool.submit([i] { return i * i; }));
    long total = 0;
    for (auto& f : results) total += f.get();
    EXPECT_EQ(total, 328350);
}

TEST(ThreadPool, DestructorFinishesQueuedJobs) {
    std::atomic<int> done{0};
    {
        ThreadPool pool(2);
        for (int i = 0; i < 50; i++)
            pool.submit([&done] {
                std::this_thread::sleep_for(std::chrono::milliseconds(1));
                done++;
            });
    }
    EXPECT_EQ(done.load(), 50);
}

TEST(WordCount, MatchesSingleThreaded) {
    std::vector<std::string> docs;
    for (int i = 0; i < 200; i++) docs.push_back("rush b rush b no stop round " + std::to_string(i % 7));
    auto counts = parallel_word_count(docs, 8);
    EXPECT_EQ(counts["rush"], 400);
    EXPECT_EQ(counts["stop"], 200);
    EXPECT_EQ(counts["3"], 29);
    auto one = parallel_word_count(docs, 1);
    EXPECT_EQ(one, counts);
}
