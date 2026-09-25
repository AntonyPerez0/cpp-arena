/* Linked into programs being traced (never shown to learners). Records every
 * heap allocation so the visualizer can draw the heap, and turns off stdout
 * buffering so output appears at the line that printed it. */
#include <stddef.h>
#include <stdio.h>

struct arena_block { void *p; size_t n; int live; };
struct arena_block arena_blocks[512];
int arena_nblocks;

void *__real_malloc(size_t);
void *__real_calloc(size_t, size_t);
void *__real_realloc(void *, size_t);
void __real_free(void *);

static void arena_add(void *p, size_t n) {
  if (p && arena_nblocks < 512) {
    arena_blocks[arena_nblocks].p = p;
    arena_blocks[arena_nblocks].n = n;
    arena_blocks[arena_nblocks].live = 1;
    arena_nblocks++;
  }
}
static void arena_del(void *p) {
  for (int i = arena_nblocks - 1; i >= 0; i--)
    if (arena_blocks[i].p == p && arena_blocks[i].live) { arena_blocks[i].live = 0; return; }
}
void *__wrap_malloc(size_t n) { void *p = __real_malloc(n); arena_add(p, n); return p; }
void *__wrap_calloc(size_t c, size_t n) { void *p = __real_calloc(c, n); arena_add(p, c * n); return p; }
void *__wrap_realloc(void *old, size_t n) { void *p = __real_realloc(old, n); if (p) { if (old) arena_del(old); arena_add(p, n); } return p; }
void __wrap_free(void *p) { if (p) arena_del(p); __real_free(p); }

__attribute__((constructor)) static void arena_unbuffer(void) { setvbuf(stdout, NULL, _IONBF, 0); }
