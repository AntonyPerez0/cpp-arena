#!/usr/bin/env bash
# Installs every tool the Pro Track uses. Safe to run more than once.
# Codespaces runs it automatically; run it yourself on any Ubuntu/Debian machine.
set -euo pipefail
SUDO=""
if [ "$(id -u)" -ne 0 ]; then SUDO="sudo"; fi
$SUDO apt-get update -qq
$SUDO apt-get install -y -qq --no-install-recommends \
  build-essential cmake ninja-build gdb valgrind \
  clang clang-tidy clang-format \
  libgtest-dev nlohmann-json3-dev \
  git python3 >/dev/null
echo "All Pro Track tools are installed. Check them with: bash tools/doctor.sh"
