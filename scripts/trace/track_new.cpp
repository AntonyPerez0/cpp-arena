// C++ programs: route new/delete through the tracked malloc/free.
#include <cstddef>
#include <new>
#include <cstdlib>
extern "C" void *__wrap_malloc(std::size_t);
extern "C" void __wrap_free(void *);
void *operator new(std::size_t n) { void *p = __wrap_malloc(n ? n : 1); if (!p) std::abort(); return p; }
void *operator new[](std::size_t n) { return operator new(n); }
void operator delete(void *p) noexcept { __wrap_free(p); }
void operator delete[](void *p) noexcept { __wrap_free(p); }
void operator delete(void *p, std::size_t) noexcept { __wrap_free(p); }
void operator delete[](void *p, std::size_t) noexcept { __wrap_free(p); }
