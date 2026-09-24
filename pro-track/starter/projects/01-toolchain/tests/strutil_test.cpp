#include <gtest/gtest.h>

#include <cstring>
#include <string>

#include "strutil.h"

TEST(StrTrim, RemovesBothEnds) {
    char s[] = "  \t gg wp \n";
    EXPECT_STREQ(str_trim(s), "gg wp");
}

TEST(StrTrim, KeepsInnerSpaces) {
    char s[] = "a  b";
    EXPECT_STREQ(str_trim(s), "a  b");
}

TEST(StrTrim, AllWhitespaceBecomesEmpty) {
    char s[] = "   \n";
    EXPECT_STREQ(str_trim(s), "");
}

TEST(StrTrim, EmptyString) {
    char s[] = "";
    EXPECT_STREQ(str_trim(s), "");
}

TEST(StrLower, LowercasesLettersOnly) {
    char s[] = "AWP 4750$ Ok";
    EXPECT_STREQ(str_lower(s), "awp 4750$ ok");
}

TEST(StrCountWords, Basics) {
    EXPECT_EQ(str_count_words("rush b"), 2u);
    EXPECT_EQ(str_count_words("  one\ttwo\nthree  "), 3u);
    EXPECT_EQ(str_count_words(""), 0u);
    EXPECT_EQ(str_count_words("   "), 0u);
}

TEST(StrNextWord, WalksAllWords) {
    const char* cursor = "  plant the\tbomb ";
    char w[16];
    ASSERT_EQ(str_next_word(&cursor, w, sizeof w), 1);
    EXPECT_STREQ(w, "plant");
    ASSERT_EQ(str_next_word(&cursor, w, sizeof w), 1);
    EXPECT_STREQ(w, "the");
    ASSERT_EQ(str_next_word(&cursor, w, sizeof w), 1);
    EXPECT_STREQ(w, "bomb");
    EXPECT_EQ(str_next_word(&cursor, w, sizeof w), 0);
}

TEST(StrNextWord, TruncatesLongWords) {
    const char* cursor = "headshot next";
    char w[5];
    ASSERT_EQ(str_next_word(&cursor, w, sizeof w), 1);
    EXPECT_STREQ(w, "head");
    ASSERT_EQ(str_next_word(&cursor, w, sizeof w), 1);
    EXPECT_STREQ(w, "next");
}
