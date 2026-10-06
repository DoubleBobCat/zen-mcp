#!/usr/bin/env bash
set -Eeuo pipefail

SCRIPT_DIR="$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)"
XDG_CONFIG_HOME="${XDG_CONFIG_HOME:-$HOME/.config}"
CONFIG_DIR="$XDG_CONFIG_HOME/zen-mcp"
CONFIG_FILE="$CONFIG_DIR/config.json"
BIN_DIR="${HOME}/.local/bin"
BIN_FILE="$BIN_DIR/zen-mcp-bridge"
SYSTEMD_USER_DIR="$XDG_CONFIG_HOME/systemd/user"
UNIT_FILE="$SYSTEMD_USER_DIR/zen-mcp-bridge.service"
UNIT_TMP="$UNIT_FILE.$$"
service_was_installed=false
if [[ -e "$UNIT_FILE" ]]; then
  service_was_installed=true
fi

if [[ "$(uname -s)" != "Linux" ]]; then
  echo "This installer supports Linux systemd user services only." >&2
  exit 1
fi
if ! command -v systemctl >/dev/null 2>&1; then
  echo "systemctl was not found. Run the bridge manually or install systemd." >&2
  exit 1
fi

install -d -m 0755 "$BIN_DIR"
install -d -m 0700 "$CONFIG_DIR"
install -d -m 0755 "$SYSTEMD_USER_DIR"
binary_updated=false
if [[ "$service_was_installed" == true ]]; then
  if [[ ! -e "$BIN_FILE" ]] || ! cmp -s "$SCRIPT_DIR/zen-mcp-bridge" "$BIN_FILE"; then
    binary_updated=true
  fi
fi

if [[ ! -e "$CONFIG_FILE" ]]; then
  install -m 0644 "$SCRIPT_DIR/config.json" "$CONFIG_FILE"
  echo "Installed default configuration at $CONFIG_FILE"
else
  echo "Keeping existing configuration at $CONFIG_FILE"
fi

escape_sed_replacement() {
  printf '%s' "$1" | sed 's/[&|\\]/\\&/g'
}

binary_value="$(escape_sed_replacement "$BIN_FILE")"
config_value="$(escape_sed_replacement "$CONFIG_FILE")"
sed \
  -e "s|@ZEN_MCP_BRIDGE_BINARY@|$binary_value|g" \
  -e "s|@ZEN_MCP_BRIDGE_CONFIG@|$config_value|g" \
  "$SCRIPT_DIR/zen-mcp-bridge.service" > "$UNIT_TMP"

unit_updated=false
if [[ "$service_was_installed" == true ]] && ! cmp -s "$UNIT_TMP" "$UNIT_FILE"; then
  unit_updated=true
fi

install -m 0755 "$SCRIPT_DIR/zen-mcp-bridge" "$BIN_FILE"
install -m 0644 "$UNIT_TMP" "$UNIT_FILE"
rm -f "$UNIT_TMP"

systemctl --user daemon-reload
if [[ "$service_was_installed" == true && ( "$binary_updated" == true || "$unit_updated" == true ) ]]; then
  systemctl --user restart zen-mcp-bridge.service
  echo "Updated zen-mcp bridge and restarted the systemd user service."
else
  systemctl --user enable --now zen-mcp-bridge.service
  echo "Installed and started the zen-mcp bridge systemd user service."
fi

echo "Status: systemctl --user status zen-mcp-bridge.service"
