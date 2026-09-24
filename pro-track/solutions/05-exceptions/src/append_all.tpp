// Template definitions must be visible where they're used, so they live in a header-like file.
#pragma once

template <typename T>
void append_all(std::vector<T>& dst, const std::vector<T>& src) {
    // Do all the work that can throw on a copy, then commit with a swap that can't throw.
    std::vector<T> tmp;
    tmp.reserve(dst.size() + src.size());
    tmp.insert(tmp.end(), dst.begin(), dst.end());
    tmp.insert(tmp.end(), src.begin(), src.end());
    dst.swap(tmp);
}
