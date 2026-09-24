# strmap API notes

## Ownership
strmap copies every key and value passed to strmap_put, and frees its copies when
an entry is replaced or removed and when the map is destroyed. Callers keep
ownership of their own strings and may change or free them right after the call.
Pointers returned by strmap_get point into the map: they stay valid only until the
next strmap_put, strmap_remove or strmap_destroy on that map, and must never be freed.

## Errors
Every function that can fail returns a strmap_status. STRMAP_EINVAL means a NULL
argument was passed, STRMAP_ENOTFOUND means the key was absent, and STRMAP_ENOMEM
means an allocation failed. On any error the map is left exactly as it was: new
memory is allocated before anything is modified. strmap_strerror turns a status
into a message. Growing the table is best effort: if that allocation fails the map
keeps working with its current table.

## Thread safety
A map is not internally synchronized. Any number of threads may call the const
functions (strmap_get, strmap_size, strmap_foreach) at the same time, but a thread
that modifies a map needs exclusive access. strmap_set_allocator changes global
state and should be called once, before any other use.

## Versioning
STRMAP_VERSION_MAJOR changes when the API or ABI breaks; STRMAP_VERSION_MINOR when
features are added compatibly. Because struct strmap is opaque, its layout can change
without breaking callers.
