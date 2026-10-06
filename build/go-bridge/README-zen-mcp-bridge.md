# zen-mcp-bridge Static Releases

[English](README-zen-mcp-bridge.md) | [简体中文](README-zen-mcp-bridge_zh.md)

The bridge is compiled with `CGO_ENABLED=0` for Linux, macOS, and Windows.
The Linux package also includes the systemd user-service installer.

## Install as a user service

On Linux with systemd user services:

```bash
cd build/go-bridge/release
./install.sh
```

The installer installs:

- Binary: `~/.local/bin/zen-mcp-bridge`
- Configuration: `${XDG_CONFIG_HOME:-~/.config}/zen-mcp/config.json`
- User unit: `${XDG_CONFIG_HOME:-~/.config}/systemd/user/zen-mcp-bridge.service`

`install.sh` fills the service paths before enabling the service.

It preserves an existing configuration file, then runs:

```bash
systemctl --user enable --now zen-mcp-bridge.service
```

If the user service manager is not available, run the binary directly:

```bash
./zen-mcp-bridge --config "$HOME/.config/zen-mcp/config.json"
```

## Configuration

Default configuration:

```json
{
  "port": "9222",
  "httpTimeout": "30s",
  "sessionIdleTimeout": "10m",
  "switchLockTimeout": "30s"
}
```

Environment variables override matching configuration values:

- `ZEN_MCP_CONFIG`
- `ZEN_MCP_PORT`
- `ZEN_MCP_HTTP_TIMEOUT`
- `ZEN_MCP_SESSION_IDLE_TIMEOUT`
- `ZEN_MCP_SWITCH_LOCK_TIMEOUT`

After editing the configuration, restart the service:

```bash
systemctl --user restart zen-mcp-bridge.service
journalctl --user -u zen-mcp-bridge.service
```

The bridge listens locally on `http://localhost:9222` by default. The MCP HTTP endpoint is `http://localhost:9222/mcp`.
