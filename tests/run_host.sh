#!/bin/sh
set -eu

cd "$(dirname "$0")/.."
artifact=$(mktemp -d /tmp/asteroids-test.XXXXXX)
trap 'rm -rf "$artifact"' EXIT
sanitizers=${SANITIZERS:-undefined}

# On macOS use the matching Xcode compiler and SDK, avoiding stale CLT stubs.
if [ "$(uname)" = Darwin ]; then
    sdk_path="$(xcode-select -p)/Platforms/MacOSX.platform/Developer/SDKs/MacOSX.sdk"
    if [ ! -d "$sdk_path" ]; then
        sdk_path=$(xcrun --show-sdk-path)
    fi
    export SDKROOT="${SDKROOT:-$sdk_path}"
    export CC="${CC:-$(xcrun --find clang)}"
    export CXX="${CXX:-$(xcrun --find clang++)}"
fi
for module in scoring difficulty score_table; do
    "${CC:-cc}" -std=c17 -pedantic -Wall -Wextra -Werror \
        -fsanitize="$sanitizers" -Iinclude -c "src/core/$module.c" \
        -o "$artifact/$module.o"
done
"${CC:-cc}" -std=c17 -pedantic -Wall -Wextra -Werror \
    -fsanitize="$sanitizers" -Iinclude tests/host/core_test.c \
    "$artifact"/*.o -o "$artifact/core-test"
"$artifact/core-test"
"${CXX:-c++}" -std=c++17 -Wall -Wextra -Werror -fsanitize="$sanitizers" \
    -Itests/host -Iinclude tests/host/game_test.cpp src/input.cpp \
    "$artifact"/*.o -o "$artifact/game-test"
"$artifact/game-test"
