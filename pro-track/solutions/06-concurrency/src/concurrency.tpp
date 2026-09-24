#pragma once

#include <memory>

// ---------------------------------------------------------------- BlockingQueue

template <typename T>
bool BlockingQueue<T>::push(T item) {
    {
        std::lock_guard<std::mutex> lock(m_);
        if (closed_) return false;
        items_.push(std::move(item));
    }
    cv_.notify_one();  // notify after unlocking so the woken thread doesn't block on m_
    return true;
}

template <typename T>
std::optional<T> BlockingQueue<T>::pop() {
    std::unique_lock<std::mutex> lock(m_);
    cv_.wait(lock, [this] { return !items_.empty() || closed_; });  // the predicate handles spurious wakeups
    if (items_.empty()) return std::nullopt;
    T item = std::move(items_.front());
    items_.pop();
    return item;
}

template <typename T>
void BlockingQueue<T>::close() {
    {
        std::lock_guard<std::mutex> lock(m_);
        closed_ = true;
    }
    cv_.notify_all();
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
