#include "strmap.h"

#include <stdlib.h>
#include <string.h>

/* TODO: design the struct (a hash table with chaining is a good choice),
   then implement every function in strmap.h. Keep helper functions static. */

struct strmap {
    size_t size;
};

strmap *strmap_create(void) { return NULL; }

void strmap_destroy(strmap *m) { (void)m; }

strmap_status strmap_put(strmap *m, const char *key, const char *value) {
    (void)m;
    (void)key;
    (void)value;
    return STRMAP_ENOMEM;
}

const char *strmap_get(const strmap *m, const char *key) {
    (void)m;
    (void)key;
    return NULL;
}

strmap_status strmap_remove(strmap *m, const char *key) {
    (void)m;
    (void)key;
    return STRMAP_ENOTFOUND;
}

size_t strmap_size(const strmap *m) { return m ? m->size : 0; }

void strmap_foreach(const strmap *m, strmap_visit_fn fn, void *ctx) {
    (void)m;
    (void)fn;
    (void)ctx;
}

const char *strmap_strerror(strmap_status s) {
    (void)s;
    return "";
}

void strmap_set_allocator(void *(*alloc)(size_t), void (*release)(void *)) {
    (void)alloc;
    (void)release;
}
