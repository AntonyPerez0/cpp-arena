// Linked into every C++ program on the site. When an exception escapes main, the
// WebAssembly engine hands it to the page instead of calling std::terminate, so the
// runner calls this to describe it: "<mangled type name>\n<what()>".
#include <cstdio>
#include <exception>
#include <typeinfo>

extern "C" void* __cxa_begin_catch(void*) noexcept;
extern "C" std::type_info* __cxa_current_exception_type() noexcept;

static char description[1024];

extern "C" __attribute__((export_name("__arena_describe_exception"))) const char* __arena_describe_exception(void* exception) {
    __cxa_begin_catch(exception);  // make it the current exception, as a catch block would
    const std::type_info* type = __cxa_current_exception_type();
    const char* what = "";
    bool has_what = false;
    try {
        throw;
    } catch (const std::exception& e) {
        what = e.what();
        has_what = true;
    } catch (...) {
    }
    std::snprintf(description, sizeof description, "%s\n%s%s", type ? type->name() : "", has_what ? "1" : "0", what);
    return description;
}
