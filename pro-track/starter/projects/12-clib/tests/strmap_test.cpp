#include <gtest/gtest.h>

#include <cstdlib>
#include <map>
#include <string>

#include "strmap.h"

TEST(Strmap, PutGetReplace) {
    strmap* m = strmap_create();
    ASSERT_NE(m, nullptr);
    EXPECT_EQ(strmap_get(m, "map"), nullptr);
    EXPECT_EQ(strmap_put(m, "map", "dust2"), STRMAP_OK);
    EXPECT_STREQ(strmap_get(m, "map"), "dust2");
    EXPECT_EQ(strmap_put(m, "map", "nuke"), STRMAP_OK);
    EXPECT_STREQ(strmap_get(m, "map"), "nuke");
    EXPECT_EQ(strmap_size(m), 1u);
    strmap_destroy(m);
}

TEST(Strmap, CopiesKeysAndValues) {
    strmap* m = strmap_create();
    char key[] = "k";
    char value[] = "v1";
    strmap_put(m, key, value);
    key[0] = 'x';
    value[1] = '9';
    EXPECT_STREQ(strmap_get(m, "k"), "v1");
    strmap_destroy(m);
}

TEST(Strmap, Remove) {
    strmap* m = strmap_create();
    strmap_put(m, "a", "1");
    strmap_put(m, "b", "2");
    EXPECT_EQ(strmap_remove(m, "a"), STRMAP_OK);
    EXPECT_EQ(strmap_remove(m, "a"), STRMAP_ENOTFOUND);
    EXPECT_EQ(strmap_get(m, "a"), nullptr);
    EXPECT_STREQ(strmap_get(m, "b"), "2");
    EXPECT_EQ(strmap_size(m), 1u);
    strmap_destroy(m);
}

TEST(Strmap, NullArguments) {
    strmap* m = strmap_create();
    EXPECT_EQ(strmap_put(nullptr, "a", "b"), STRMAP_EINVAL);
    EXPECT_EQ(strmap_put(m, nullptr, "b"), STRMAP_EINVAL);
    EXPECT_EQ(strmap_put(m, "a", nullptr), STRMAP_EINVAL);
    EXPECT_EQ(strmap_get(nullptr, "a"), nullptr);
    EXPECT_EQ(strmap_get(m, nullptr), nullptr);
    EXPECT_EQ(strmap_remove(nullptr, "a"), STRMAP_EINVAL);
    EXPECT_EQ(strmap_size(nullptr), 0u);
    strmap_destroy(nullptr);
    strmap_destroy(m);
}

TEST(Strmap, ManyKeysMatchStdMap) {
    strmap* m = strmap_create();
    std::map<std::string, std::string> ref;
    for (int i = 0; i < 20000; i++) {
        std::string k = "key" + std::to_string((i * 7919) % 5000);
        std::string v = "value" + std::to_string(i);
        ASSERT_EQ(strmap_put(m, k.c_str(), v.c_str()), STRMAP_OK);
        ref[k] = v;
        if (i % 3 == 0) {
            std::string r = "key" + std::to_string(i % 5000);
            bool had = ref.erase(r) == 1;
            EXPECT_EQ(strmap_remove(m, r.c_str()), had ? STRMAP_OK : STRMAP_ENOTFOUND);
        }
    }
    EXPECT_EQ(strmap_size(m), ref.size());
    for (const auto& [k, v] : ref) ASSERT_STREQ(strmap_get(m, k.c_str()), v.c_str());
    strmap_destroy(m);
}

static int collect(const char* key, const char* value, void* ctx) {
    (*static_cast<std::map<std::string, std::string>*>(ctx))[key] = value;
    return 0;
}

static int stop_after_two(const char*, const char*, void* ctx) {
    return ++*static_cast<int*>(ctx) >= 2;
}

TEST(Strmap, Foreach) {
    strmap* m = strmap_create();
    strmap_put(m, "a", "1");
    strmap_put(m, "b", "2");
    strmap_put(m, "c", "3");
    std::map<std::string, std::string> seen;
    strmap_foreach(m, collect, &seen);
    EXPECT_EQ(seen, (std::map<std::string, std::string>{{"a", "1"}, {"b", "2"}, {"c", "3"}}));
    int calls = 0;
    strmap_foreach(m, stop_after_two, &calls);
    EXPECT_EQ(calls, 2);
    strmap_destroy(m);
}

TEST(Strmap, Strerror) {
    EXPECT_STRNE(strmap_strerror(STRMAP_OK), "");
    EXPECT_STRNE(strmap_strerror(STRMAP_ENOMEM), strmap_strerror(STRMAP_EINVAL));
    EXPECT_STRNE(strmap_strerror(static_cast<strmap_status>(99)), "");
}

// ---------------------------------------------------------------- out of memory
static int g_allocs_left = 0;
static int g_live = 0;
static void* limited_alloc(std::size_t n) {
    if (g_allocs_left-- <= 0) return nullptr;
    g_live++;
    return std::malloc(n);
}
static void counted_free(void* p) {
    if (p) g_live--;
    std::free(p);
}

TEST(Strmap, OutOfMemoryLeavesMapUnchangedAndLeaksNothing) {
    for (int budget = 0; budget < 40; budget++) {
        g_live = 0;
        g_allocs_left = 1000;
        strmap_set_allocator(limited_alloc, counted_free);
        strmap* m = strmap_create();
        ASSERT_NE(m, nullptr);
        for (int i = 0; i < 20; i++) {
            std::string k = "k" + std::to_string(i);
            ASSERT_EQ(strmap_put(m, k.c_str(), "v"), STRMAP_OK);
        }
        g_allocs_left = budget;  // now allocations start failing
        for (int i = 0; i < 20; i++) {
            std::string k = "new" + std::to_string(i);
            strmap_status s = strmap_put(m, k.c_str(), "value");
            if (s != STRMAP_OK) {
                EXPECT_EQ(s, STRMAP_ENOMEM);
                EXPECT_EQ(strmap_get(m, k.c_str()), nullptr);
            }
        }
        strmap_status s = strmap_put(m, "k3", "replaced");
        EXPECT_TRUE(s == STRMAP_OK || s == STRMAP_ENOMEM);
        EXPECT_STREQ(strmap_get(m, "k3"), s == STRMAP_OK ? "replaced" : "v") << "budget " << budget;
        for (int i = 0; i < 20; i++) {
            std::string k = "k" + std::to_string(i);
            ASSERT_NE(strmap_get(m, k.c_str()), nullptr) << "lost key " << k << " at budget " << budget;
        }
        g_allocs_left = 1000;
        strmap_destroy(m);
        EXPECT_EQ(g_live, 0) << "leaked allocations at budget " << budget;
        strmap_set_allocator(nullptr, nullptr);
    }
}

TEST(Strmap, CreateFailsCleanly) {
    g_allocs_left = 0;
    g_live = 0;
    strmap_set_allocator(limited_alloc, counted_free);
    EXPECT_EQ(strmap_create(), nullptr);
    g_allocs_left = 1;
    strmap* m = strmap_create();  // may need more than one allocation
    if (m) strmap_destroy(m);
    EXPECT_EQ(g_live, 0);
    strmap_set_allocator(nullptr, nullptr);
}
