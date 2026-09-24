#ifndef STRUTIL_H
#define STRUTIL_H

#include <stddef.h>

/* The extern "C" block lets C++ code (like the tests) call these C functions. */
#ifdef __cplusplus
extern "C" {
#endif

/* Removes leading and trailing whitespace from s, in place. Returns s. */
char *str_trim(char *s);

/* Converts ASCII letters in s to lowercase, in place. Returns s. */
char *str_lower(char *s);

/* Counts words: maximal runs of non-whitespace characters. */
size_t str_count_words(const char *s);

/* Copies the next word starting at *cursor into out (at most out_size - 1
   characters, always '\0'-terminated; longer words are truncated) and moves
   *cursor past the word. Returns 1 if a word was found, 0 at the end. */
int str_next_word(const char **cursor, char *out, size_t out_size);

#ifdef __cplusplus
}
#endif

#endif /* STRUTIL_H */
