# zen-mcp-bridge 静态发布包

[English](README-zen-mcp-bridge.md) | [简体中文](README-zen-mcp-bridge_zh.md)

bridge 使用 `CGO_ENABLED=0` 为 Linux、macOS 和 Windows 编译。Linux 发布包还包含 systemd user service 安装器。

## 安装为用户服务

在支持 systemd user service 的 Linux 系统上运行：

```bash
cd build/go-bridge/release
./install.sh
```

安装器会安装：

- 二进制文件：`~/.local/bin/zen-mcp-bridge`
- 配置文件：`${XDG_CONFIG_HOME:-~/.config}/zen-mcp/config.json`
- 用户单元：`${XDG_CONFIG_HOME:-~/.config}/systemd/user/zen-mcp-bridge.service`

启用服务前，`install.sh` 会填充服务路径。安装器会保留已有配置文件，然后执行：

```bash
systemctl --user enable --now zen-mcp-bridge.service
```

如果系统没有用户服务管理器，可以直接运行二进制文件：

```bash
./zen-mcp-bridge --config "$HOME/.config/zen-mcp/config.json"
```

## 配置

默认配置：

```json
{
  "port": "9222",
  "httpTimeout": "30s",
  "sessionIdleTimeout": "10m",
  "switchLockTimeout": "30s"
}
```

以下环境变量会覆盖对应的配置值：

- `ZEN_MCP_CONFIG`
- `ZEN_MCP_PORT`
- `ZEN_MCP_HTTP_TIMEOUT`
- `ZEN_MCP_SESSION_IDLE_TIMEOUT`
- `ZEN_MCP_SWITCH_LOCK_TIMEOUT`

修改配置后重启服务：

```bash
systemctl --user restart zen-mcp-bridge.service
journalctl --user -u zen-mcp-bridge.service
```

bridge 默认监听本地地址 `http://localhost:9222`，MCP HTTP 端点为 `http://localhost:9222/mcp`。
