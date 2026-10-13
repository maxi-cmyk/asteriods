#!/bin/sh
set -eu
cd "$(dirname "$0")/.."
artifact=$(mktemp /tmp/asteroids-test.XXXXXX)
trap 'rm -f "$artifact"' EXIT
sanitizers=${SANITIZERS:-undefined}
c++ -std=c++17 -Wall -Wextra -Werror -fsanitize="$sanitizers" -Itests/host -Iinclude tests/host/game_test.cpp src/input.cpp -o "$artifact"
"$artifact"
