/*
 * strmap: a string-to-string hash map for C (and C++).
 *
 * This header is the library's entire public interface. It must compile as
 * strict C99 and as C++, and the library must export no other symbols.
 *
 * Ownership: strmap copies every key and value it stores, and frees them itself.
 * Callers never free anything returned by strmap except the map (strmap_destroy).
 */
#ifndef STRMAP_H
#define STRMAP_H

#include <stddef.h>

#ifdef __cplusplus
extern "C" {
#endif

#define STRMAP_VERSION_MAJOR 1
#define STRMAP_VERSION_MINOR 0

/* Opaque: callers only ever hold a pointer, so the layout can change freely. */
typedef struct strmap strmap;

typedef enum {
    STRMAP_OK = 0,
    STRMAP_ENOMEM,    /* an allocation failed; the map is unchanged */
    STRMAP_ENOTFOUND, /* no such key */
    STRMAP_EINVAL     /* a NULL map, key or value was passed */
} strmap_status;

/* A new empty map, or NULL if allocation fails. */
strmap *strmap_create(void);

/* Frees the map and everything in it. strmap_destroy(NULL) does nothing. */
void strmap_destroy(strmap *m);

/* Inserts or replaces. On any error the map is left exactly as it was. */
strmap_status strmap_put(strmap *m, const char *key, const char *value);

/* The value for key, or NULL if absent (or if m or key is NULL). The pointer
   stays valid until the next strmap_put/strmap_remove/strmap_destroy on m. */
const char *strmap_get(const strmap *m, const char *key);

/* Removes key. STRMAP_ENOTFOUND if it wasn't there. */
strmap_status strmap_remove(strmap *m, const char *key);

/* Number of keys (0 for NULL). */
size_t strmap_size(const strmap *m);

/* Calls fn for every entry, in no particular order, until fn returns nonzero.
   fn must not modify the map. */
typedef int (*strmap_visit_fn)(const char *key, const char *value, void *ctx);
void strmap_foreach(const strmap *m, strmap_visit_fn fn, void *ctx);

/* A short, static, human-readable description of a status. */
const char *strmap_strerror(strmap_status s);

/* Replaces malloc/free for all future allocations (used by tests to simulate
   running out of memory). Passing NULL for either restores malloc/free. */
void strmap_set_allocator(void *(*alloc)(size_t), void (*release)(void *));

#ifdef __cplusplus
}
#endif

#endif /* STRMAP_H */
