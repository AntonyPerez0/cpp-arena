#include "strutil.h"

#include <ctype.h>
#include <string.h>

char *str_trim(char *s) {
    /* TODO: remove leading and trailing whitespace in place (isspace). */
    return s;
}

char *str_lower(char *s) {
    /* TODO: lowercase every ASCII letter (tolower). */
    return s;
}

size_t str_count_words(const char *s) {
    /* TODO: count runs of non-whitespace characters. */
    (void)s;
    return 0;
}

int str_next_word(const char **cursor, char *out, size_t out_size) {
    /* TODO: skip whitespace, copy one word (truncating to out_size - 1), advance *cursor. */
    (void)cursor;
    (void)out;
    (void)out_size;
    return 0;
}
