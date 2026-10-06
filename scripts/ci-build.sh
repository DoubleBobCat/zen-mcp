#!/usr/bin/env bash
set -Eeuo pipefail

ROOT_DIR="$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)"
npm --prefix "$ROOT_DIR/build/extension" run build:all
shopt -s nullglob
xpis=("$ROOT_DIR/build/artifacts"/*.xpi)
test "${#xpis[@]}" -eq 1
test -s "${xpis[0]}"
test -s "$ROOT_DIR/build/artifacts/zen-mcp-bridge-linux-amd64.tar.gz"
test -s "$ROOT_DIR/build/artifacts/zen-mcp-bridge-darwin-amd64.tar.gz"
test -s "$ROOT_DIR/build/artifacts/zen-mcp-bridge-windows-amd64.zip"
