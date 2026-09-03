#!/bin/sh
set -eu

VERSION='4.0.1'
ARCHIVE='rosu_pp_js_web.tar.gz'
URL="https://github.com/MaxOhn/rosu-pp-js/releases/download/v${VERSION}/${ARCHIVE}"
SHA256='fae917e5e8a932d15d1bff49a8a26a14502b4d8d0b2b82a1b7cf0823fe825e74'

TMP_DIR="$(mktemp -d)"
trap 'rm -rf "$TMP_DIR"' EXIT INT TERM

printf 'Updating rosu-pp-js to v%s...\n' "$VERSION"
curl -fL --retry 3 --retry-delay 2 "$URL" -o "$TMP_DIR/$ARCHIVE"
printf '%s  %s\n' "$SHA256" "$TMP_DIR/$ARCHIVE" | sha256sum -c -

mkdir -p "$TMP_DIR/unpack"
tar -xzf "$TMP_DIR/$ARCHIVE" -C "$TMP_DIR/unpack"

JS_FILE="$(find "$TMP_DIR/unpack" -type f -name 'rosu_pp_js.js' | head -n 1)"
WASM_FILE="$(find "$TMP_DIR/unpack" -type f -name 'rosu_pp_js_bg.wasm' | head -n 1)"

if [ -z "$JS_FILE" ] || [ -z "$WASM_FILE" ]; then
  echo 'rosu-pp-js web archive layout is unexpected.' >&2
  exit 1
fi

mkdir -p js/rosu_pp_js
cp "$JS_FILE" js/rosu_pp_js/rosu_pp_js.js
cp "$WASM_FILE" js/rosu_pp_js/rosu_pp_js_bg.wasm
printf 'rosu-pp-js v%s installed.\n' "$VERSION"
