#!/bin/sh
set -eu
cd "$(dirname "$0")/.."
formatter=${CLANG_FORMAT:-clang-format}
if ! command -v "$formatter" >/dev/null 2>&1; then
    formatter=/opt/homebrew/opt/llvm/bin/clang-format
fi
"$formatter" -i include/core/*.h src/core/*.c
