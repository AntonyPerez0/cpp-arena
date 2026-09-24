/* How a user of the library would call it. Builds as part of the project. */
#include <stdio.h>

#include "strmap.h"

static int print_entry(const char *key, const char *value, void *ctx) {
    (void)ctx;
    printf("%s = %s\n", key, value);
    return 0;
}

int main(void) {
    strmap *m = strmap_create();
    if (m == NULL) return 1;
    strmap_status s = strmap_put(m, "map", "de_inferno");
    if (s != STRMAP_OK) {
        fprintf(stderr, "put failed: %s\n", strmap_strerror(s));
        strmap_destroy(m);
        return 1;
    }
    strmap_put(m, "mode", "competitive");
    strmap_foreach(m, print_entry, NULL);
    printf("%zu entries, map is %s\n", strmap_size(m), strmap_get(m, "map"));
    strmap_destroy(m);
    return 0;
}
