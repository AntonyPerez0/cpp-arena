#pragma once

#include <memory>

// ---------------------------------------------------------------- BlockingQueue

template <typename T>
bool BlockingQueue<T>::push(T item) {
    // TODO: lock, refuse if closed, push, then notify one waiting pop().
    items_.push(std::move(item));
    return true;
}

template <typename T>
std::optional<T> BlockingQueue<T>::pop() {
    // TODO: wait on cv_ until there's an item or the queue is closed.
    if (items_.empty()) return std::nullopt;
    T item = std::move(items_.front());
    items_.pop();
    return item;
}

template <typename T>
void BlockingQueue<T>::close() {
    // TODO: lock, mark closed, wake ALL waiting threads.
    closed_ = true;
}

template <typename T>
std::size_t BlockingQueue<T>::size() const {
    std::lock_guard<std::mutex> lock(m_);
    return items_.size();
}

// ---------------------------------------------------------------- ThreadPool

template <typename F>
auto ThreadPool::submit(F f) -> std::future<decltype(f())> {
    using R = decltype(f());
    // std::packaged_task isn't copyable, but std::function needs a copyable
    // callable, so it lives in a shared_ptr.
    auto task = std::make_shared<std::packaged_task<R()>>(std::move(f));
    std::future<R> result = task->get_future();
    jobs_.push([task] { (*task)(); });
    return result;
}
