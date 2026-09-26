#!/usr/bin/env bash
# Rebuilds vendor/libcxx-eh: libc++, libc++abi and libunwind with WebAssembly
# exception handling, plus libarena.a (the uncaught-exception reporter). They
# replace the no-exceptions libraries in browsercc's sysroot (see
# scripts/copy-toolchain.mjs). Needs git, cmake, ninja, and clang/llvm-ar with the
# WebAssembly target (Ubuntu's clang 18 works). Takes a few minutes.
#
# Versions matter: the headers in browsercc's sysroot are libc++ 19.1.5, so the
# libraries are built from the same release, and must be configured like it
# (ABI version 2, no threads, no hardening). The script checks that the built
# headers match the sysroot's exactly.
set -euo pipefail
ROOT=$(cd "$(dirname "$0")/.." && pwd)
WORK=${WORK:-$(mktemp -d)}
LLVM_TAG=llvmorg-19.1.5
echo "working in $WORK"

git clone --depth 1 --branch "$LLVM_TAG" --filter=blob:none --sparse https://github.com/llvm/llvm-project "$WORK/llvm-project"
git -C "$WORK/llvm-project" sparse-checkout set cmake runtimes libcxx libcxxabi libunwind llvm/cmake llvm/utils/llvm-lit third-party
# libunwind: on wasm only Unwind-wasm.c applies (no native register code), and no __declspec.
git -C "$WORK/llvm-project" apply "$ROOT/vendor/libcxx-eh/llvm-wasm-eh.patch"

mkdir -p "$WORK/sysroot"
tar -C "$WORK/sysroot" -xf "$ROOT/node_modules/browsercc/dist/sysroot.tar"

# CMake's WASI platform file comes from wasi-sdk.
git clone --depth 1 https://github.com/WebAssembly/wasi-sdk "$WORK/wasi-sdk"

# __WASM_EXCEPTIONS__ selects the wasm code paths in libunwind and libc++abi (newer
# LLVM defines it itself). Legacy wasm EH instructions, which every current browser runs.
FLAGS="-fwasm-exceptions -D__WASM_EXCEPTIONS__ -Wno-deprecated -ffile-prefix-map=$WORK=."
cmake -G Ninja -S "$WORK/llvm-project/runtimes" -B "$WORK/build" \
  -DCMAKE_BUILD_TYPE=MinSizeRel \
  -DCMAKE_C_COMPILER=clang -DCMAKE_CXX_COMPILER=clang++ -DCMAKE_AR="$(command -v llvm-ar)" -DCMAKE_RANLIB="$(command -v llvm-ranlib)" \
  -DCMAKE_C_COMPILER_TARGET=wasm32-wasi -DCMAKE_CXX_COMPILER_TARGET=wasm32-wasi -DCMAKE_ASM_COMPILER_TARGET=wasm32-wasi \
  -DCMAKE_SYSTEM_NAME=WASI -DCMAKE_MODULE_PATH="$WORK/wasi-sdk/cmake" -DCMAKE_SYSROOT="$WORK/sysroot" \
  -DCMAKE_TRY_COMPILE_TARGET_TYPE=STATIC_LIBRARY -DCMAKE_C_COMPILER_WORKS=ON -DCMAKE_CXX_COMPILER_WORKS=ON -DLLVM_COMPILER_CHECKED=ON \
  -DCMAKE_POSITION_INDEPENDENT_CODE=OFF \
  -DLLVM_ENABLE_RUNTIMES="libunwind;libcxxabi;libcxx" \
  -DLIBCXX_ENABLE_THREADS=OFF -DLIBCXXABI_ENABLE_THREADS=OFF -DLIBUNWIND_ENABLE_THREADS=OFF \
  -DLIBCXX_ENABLE_SHARED=OFF -DLIBCXXABI_ENABLE_SHARED=OFF -DLIBUNWIND_ENABLE_SHARED=OFF \
  -DLIBCXX_ENABLE_EXCEPTIONS=ON -DLIBCXXABI_ENABLE_EXCEPTIONS=ON -DLIBCXXABI_USE_LLVM_UNWINDER=ON \
  -DLIBCXX_ENABLE_FILESYSTEM=ON -DLIBCXX_CXX_ABI=libcxxabi -DLIBCXX_HAS_MUSL_LIBC=ON -DLIBCXX_ABI_VERSION=2 \
  -DLIBCXX_HARDENING_MODE=none -DLIBCXX_ENABLE_TIME_ZONE_DATABASE=OFF \
  -DLIBCXXABI_SILENT_TERMINATE=ON -DLIBUNWIND_USE_COMPILER_RT=ON -DUNIX=ON \
  -DLIBUNWIND_ENABLE_ASSERTIONS=OFF -DLIBCXXABI_ENABLE_ASSERTIONS=OFF \
  -DLIBCXX_INCLUDE_TESTS=OFF -DLIBCXX_INCLUDE_BENCHMARKS=OFF -DLIBUNWIND_INCLUDE_TESTS=OFF -DLIBCXXABI_INCLUDE_TESTS=OFF \
  -DCMAKE_C_FLAGS="$FLAGS" -DCMAKE_CXX_FLAGS="$FLAGS" -DCMAKE_ASM_FLAGS="-fwasm-exceptions" \
  -DCMAKE_INSTALL_PREFIX="$WORK/install"
ninja -C "$WORK/build" install

diff -r "$WORK/sysroot/include/c++/v1" "$WORK/install/include/c++/v1" >/dev/null || { echo "built headers differ from the sysroot's"; exit 1; }

clang++ --target=wasm32-wasi --sysroot="$WORK/sysroot" -nostdinc++ -isystem "$WORK/sysroot/include/c++/v1" -isystem "$WORK/sysroot/include/wasm32-wasi" \
  -std=c++20 -O2 -fwasm-exceptions -c "$ROOT/vendor/libcxx-eh/uncaught.cpp" -o "$WORK/uncaught.o"
rm -f "$WORK/libarena.a"
llvm-ar rcs "$WORK/libarena.a" "$WORK/uncaught.o"

cp "$WORK/install/lib/libc++.a" "$WORK/install/lib/libc++abi.a" "$WORK/install/lib/libunwind.a" "$WORK/libarena.a" "$ROOT/vendor/libcxx-eh/"
echo "updated vendor/libcxx-eh"
