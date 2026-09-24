#include "strmap.h"

#include <stdint.h>
#include <stdlib.h>
#include <string.h>

typedef struct entry {
    char *key;
    char *value;
    uint64_t hash;
    struct entry *next;
} entry;

struct strmap {
    entry **buckets;
    size_t nbuckets; /* always a power of two */
    size_t size;
};

static void *(*g_alloc)(size_t) = malloc;
static void (*g_free)(void *) = free;

void strmap_set_allocator(void *(*alloc)(size_t), void (*release)(void *)) {
    g_alloc = alloc ? alloc : malloc;
    g_free = release ? release : free;
}

static uint64_t hash_str(const char *s) {
    uint64_t h = 14695981039346656037ULL; /* FNV-1a */
    for (const unsigned char *p = (const unsigned char *)s; *p; p++) {
        h ^= *p;
        h *= 1099511628211ULL;
    }
    return h;
}

static char *dup_str(const char *s) {
    size_t n = strlen(s) + 1;
    char *copy = g_alloc(n);
    if (copy) memcpy(copy, s, n);
    return copy;
}

static entry **find_slot(const strmap *m, const char *key, uint64_t h) {
    entry **slot = &m->buckets[h & (m->nbuckets - 1)];
    while (*slot && ((*slot)->hash != h || strcmp((*slot)->key, key) != 0)) slot = &(*slot)->next;
    return slot;
}

/* Doubles the table. On allocation failure the old table is kept, which is
   still correct, just slower, so callers can ignore the result. */
static void grow(strmap *m) {
    size_t n = m->nbuckets * 2;
    entry **nb = g_alloc(n * sizeof *nb);
    if (nb == NULL) return;
    memset(nb, 0, n * sizeof *nb);
    for (size_t i = 0; i < m->nbuckets; i++) {
        entry *e = m->buckets[i];
        while (e) {
            entry *next = e->next;
            size_t b = e->hash & (n - 1);
            e->next = nb[b];
            nb[b] = e;
            e = next;
        }
    }
    g_free(m->buckets);
    m->buckets = nb;
    m->nbuckets = n;
}

strmap *strmap_create(void) {
    strmap *m = g_alloc(sizeof *m);
    if (m == NULL) return NULL;
    m->nbuckets = 16;
    m->size = 0;
    m->buckets = g_alloc(m->nbuckets * sizeof *m->buckets);
    if (m->buckets == NULL) {
        g_free(m);
        return NULL;
    }
    memset(m->buckets, 0, m->nbuckets * sizeof *m->buckets);
    return m;
}

static void free_entry(entry *e) {
    g_free(e->key);
    g_free(e->value);
    g_free(e);
}

void strmap_destroy(strmap *m) {
    if (m == NULL) return;
    for (size_t i = 0; i < m->nbuckets; i++) {
        entry *e = m->buckets[i];
        while (e) {
            entry *next = e->next;
            free_entry(e);
            e = next;
        }
    }
    g_free(m->buckets);
    g_free(m);
}

strmap_status strmap_put(strmap *m, const char *key, const char *value) {
    if (m == NULL || key == NULL || value == NULL) return STRMAP_EINVAL;
    uint64_t h = hash_str(key);
    entry **slot = find_slot(m, key, h);
    char *v = dup_str(value); /* allocate before changing anything */
    if (v == NULL) return STRMAP_ENOMEM;
    if (*slot) { /* replace */
        g_free((*slot)->value);
        (*slot)->value = v;
        return STRMAP_OK;
    }
    entry *e = g_alloc(sizeof *e);
    char *k = e ? dup_str(key) : NULL;
    if (e == NULL || k == NULL) {
        g_free(e);
        g_free(v);
        return STRMAP_ENOMEM;
    }
    e->key = k;
    e->value = v;
    e->hash = h;
    e->next = NULL;
    *slot = e;
    m->size++;
    if (m->size * 4 > m->nbuckets * 3) grow(m);
    return STRMAP_OK;
}

const char *strmap_get(const strmap *m, const char *key) {
    if (m == NULL || key == NULL) return NULL;
    entry *e = *find_slot(m, key, hash_str(key));
    return e ? e->value : NULL;
}

strmap_status strmap_remove(strmap *m, const char *key) {
    if (m == NULL || key == NULL) return STRMAP_EINVAL;
    entry **slot = find_slot(m, key, hash_str(key));
    if (*slot == NULL) return STRMAP_ENOTFOUND;
    entry *e = *slot;
    *slot = e->next;
    free_entry(e);
    m->size--;
    return STRMAP_OK;
}

size_t strmap_size(const strmap *m) { return m ? m->size : 0; }

void strmap_foreach(const strmap *m, strmap_visit_fn fn, void *ctx) {
    if (m == NULL || fn == NULL) return;
    for (size_t i = 0; i < m->nbuckets; i++)
        for (entry *e = m->buckets[i]; e; e = e->next)
            if (fn(e->key, e->value, ctx)) return;
}

const char *strmap_strerror(strmap_status s) {
    switch (s) {
        case STRMAP_OK: return "success";
        case STRMAP_ENOMEM: return "out of memory";
        case STRMAP_ENOTFOUND: return "key not found";
        case STRMAP_EINVAL: return "invalid argument";
    }
    return "unknown status";
}
