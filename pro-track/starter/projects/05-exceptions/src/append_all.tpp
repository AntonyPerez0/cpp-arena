// Template definitions must be visible where they're used, so they live in a header-like file.
#pragma once

template <typename T>
void append_all(std::vector<T>& dst, const std::vector<T>& src) {
    // TODO: strong guarantee. As written, a throwing copy leaves dst half-appended.
    for (const T& x : src) dst.push_back(x);
}
