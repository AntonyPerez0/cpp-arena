#include "strutil.h"

#include <ctype.h>
#include <string.h>

char *str_trim(char *s) {
    char *start = s;
    while (*start && isspace((unsigned char)*start)) start++;
    size_t len = strlen(start);
    while (len > 0 && isspace((unsigned char)start[len - 1])) len--;
    memmove(s, start, len);
    s[len] = '\0';
    return s;
}

char *str_lower(char *s) {
    for (char *p = s; *p; p++) *p = (char)tolower((unsigned char)*p);
    return s;
}

size_t str_count_words(const char *s) {
    size_t n = 0;
    int in_word = 0;
    for (; *s; s++) {
        if (isspace((unsigned char)*s)) {
            in_word = 0;
        } else if (!in_word) {
            in_word = 1;
            n++;
        }
    }
    return n;
}

int str_next_word(const char **cursor, char *out, size_t out_size) {
    const char *p = *cursor;
    while (*p && isspace((unsigned char)*p)) p++;
    if (*p == '\0') {
        *cursor = p;
        return 0;
    }
    size_t n = 0;
    while (*p && !isspace((unsigned char)*p)) {
        if (n + 1 < out_size) out[n++] = *p;
        p++;
    }
    if (out_size > 0) out[n] = '\0';
    *cursor = p;
    return 1;
}
