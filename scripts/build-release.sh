#!/usr/bin/env bash
set -Eeuo pipefail

ROOT_DIR="$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)"
ARTIFACTS_DIR="$ROOT_DIR/build/artifacts"
RELEASE_DIR="$ROOT_DIR/build/go-bridge/release"
WORK_DIR="$ROOT_DIR/build/go-bridge/work"
SOURCE_DIR="$ROOT_DIR/src/go-bridge"

rm -rf "$WORK_DIR"
mkdir -p "$WORK_DIR/static"
cp -r "$SOURCE_DIR"/. "$WORK_DIR/"
cp "$ROOT_DIR/src/debug-frontend/index.html" "$ROOT_DIR/src/debug-frontend/debug.js" "$ROOT_DIR/src/debug-frontend/mcp-client.js" "$ROOT_DIR/src/debug-frontend/bridge.js" "$WORK_DIR/static/"

rm -rf "$ARTIFACTS_DIR" "$RELEASE_DIR"
mkdir -p "$ARTIFACTS_DIR" "$RELEASE_DIR" "$ROOT_DIR/build/go-bridge/dist"

if ! command -v zip >/dev/null 2>&1; then
  echo "zip is required to package the Windows bridge release" >&2
  exit 1
fi
if ! command -v tar >/dev/null 2>&1; then
  echo "tar is required to package bridge releases" >&2
  exit 1
fi

build_bridge() {
  local goos="$1" goarch="$2" suffix="$3"
  local output="$WORK_DIR/zen-mcp-bridge${suffix}"
  (cd "$WORK_DIR" && CGO_ENABLED=0 GOOS="$goos" GOARCH="$goarch" go build -trimpath -ldflags='-s -w' -o "$output" .)
  if [[ "$goos" == "linux" ]]; then
    install -m 0755 "$output" "$RELEASE_DIR/zen-mcp-bridge"
  fi
}

build_bridge linux amd64 ""
build_bridge darwin amd64 "-darwin-amd64"
build_bridge windows amd64 ".exe"

install -m 0644 "$ROOT_DIR/release/bridge-config.json" "$RELEASE_DIR/config.json"
install -m 0644 "$ROOT_DIR/release/zen-mcp-bridge.service" "$RELEASE_DIR/zen-mcp-bridge.service"
install -m 0755 "$ROOT_DIR/release/install.sh" "$RELEASE_DIR/install.sh"
install -m 0644 "$ROOT_DIR/release/README.md" "$RELEASE_DIR/README.md"
install -m 0644 "$ROOT_DIR/release/README_zh.md" "$RELEASE_DIR/README_zh.md"
install -m 0644 "$ROOT_DIR/release/README-zen-mcp-bridge.md" "$ROOT_DIR/build/go-bridge/README-zen-mcp-bridge.md"
install -m 0644 "$ROOT_DIR/release/README-zen-mcp-bridge_zh.md" "$ROOT_DIR/build/go-bridge/README-zen-mcp-bridge_zh.md"
install -m 0644 "$ROOT_DIR/release/README-xpi.md" "$ROOT_DIR/build/extension/README-xpi.md"
install -m 0644 "$ROOT_DIR/release/README-xpi_zh.md" "$ROOT_DIR/build/extension/README-xpi_zh.md"

tar -czf "$ARTIFACTS_DIR/zen-mcp-bridge-linux-amd64.tar.gz" -C "$ROOT_DIR/build/go-bridge" release
for platform in darwin-amd64 windows-amd64; do
  package_dir="$WORK_DIR/release-$platform"
  rm -rf "$package_dir"
  mkdir -p "$package_dir"
  binary="$WORK_DIR/zen-mcp-bridge-${platform}"
  [[ "$platform" == "windows-amd64" ]] && binary="$WORK_DIR/zen-mcp-bridge.exe"
  install -m 0755 "$binary" "$package_dir/$(basename "$binary")"
  install -m 0644 "$ROOT_DIR/release/bridge-config.json" "$package_dir/config.json"
  install -m 0644 "$ROOT_DIR/release/README-zen-mcp-bridge.md" "$package_dir/README.md"
  install -m 0644 "$ROOT_DIR/release/README-zen-mcp-bridge_zh.md" "$package_dir/README_zh.md"
  install -m 0644 "$ROOT_DIR/release/README-zen-mcp-bridge.md" "$package_dir/README-zen-mcp-bridge.md"
  install -m 0644 "$ROOT_DIR/release/README-zen-mcp-bridge_zh.md" "$package_dir/README-zen-mcp-bridge_zh.md"
done
tar -czf "$ARTIFACTS_DIR/zen-mcp-bridge-darwin-amd64.tar.gz" -C "$WORK_DIR" release-darwin-amd64
(cd "$WORK_DIR/release-windows-amd64" && zip -qr "$ARTIFACTS_DIR/zen-mcp-bridge-windows-amd64.zip" .)

install -m 0755 "$WORK_DIR/zen-mcp-bridge" "$ROOT_DIR/build/go-bridge/dist/zen-mcp-bridge"
echo "Built static bridge packages under $ARTIFACTS_DIR"
echo "Built Linux bridge service release at $RELEASE_DIR"
