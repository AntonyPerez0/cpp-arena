/* wordfreq FILE: prints the three most common words in FILE (case-insensitive).
   This file is complete. It only needs the strutil library to link. */
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

#include "strutil.h"

#define MAX_WORDS 4096

typedef struct {
    char word[64];
    int count;
} Entry;

static int by_count(const void *pa, const void *pb) {
    const Entry *a = pa, *b = pb;
    if (a->count != b->count) return (b->count > a->count) - (b->count < a->count);
    return strcmp(a->word, b->word);
}

int main(int argc, char **argv) {
    if (argc != 2) {
        fprintf(stderr, "usage: wordfreq FILE\n");
        return 2;
    }
    FILE *f = fopen(argv[1], "r");
    if (f == NULL) {
        perror(argv[1]);
        return 1;
    }
    static Entry entries[MAX_WORDS];
    int n = 0;
    char line[1024];
    while (fgets(line, sizeof line, f) != NULL) {
        str_lower(line);
        const char *cursor = line;
        char word[64];
        while (str_next_word(&cursor, word, sizeof word)) {
            int i = 0;
            while (i < n && strcmp(entries[i].word, word) != 0) i++;
            if (i == n) {
                if (n == MAX_WORDS) continue;
                strcpy(entries[n].word, word);
                entries[n].count = 0;
                n++;
            }
            entries[i].count++;
        }
    }
    fclose(f);
    qsort(entries, (size_t)n, sizeof entries[0], by_count);
    for (int i = 0; i < n && i < 3; i++) printf("%s %d\n", entries[i].word, entries[i].count);
    return 0;
}
