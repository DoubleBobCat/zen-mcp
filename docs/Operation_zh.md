# 运行与运维：Zen MCP 浏览器自动化

[English](Operation.md) | [简体中文](Operation_zh.md)

## 启动和检查

前台 bridge：

```bash
npm --prefix build/extension run bridge
```

用户服务：

```bash
systemctl --user status zen-mcp-bridge.service
systemctl --user restart zen-mcp-bridge.service
journalctl --user -u zen-mcp-bridge.service
```

bridge 会将客户端连接/断开、扩展生命周期、会话清理、转发失败和 HTTP 超时记录到进程输出或 journal。

## 端点

- 调试前端：`http://localhost:9222/`
- 外部 WebSocket MCP：`ws://localhost:9222` 或 `/ws`
- 扩展 WebSocket：`ws://localhost:9222?type=extension`
- Streamable HTTP MCP：`POST http://localhost:9222/mcp`

## 故障排查

### 扩展不可用

HTTP 调用返回 `503`，WebSocket 调用返回 `Extension not connected` JSON-RPC 错误。确认 XPI 已加载、扩展设置使用正确 URL 且 bridge 正在配置的端口监听。

### HTTP 超时

HTTP `504` 表示扩展未在 `ZEN_MCP_HTTP_TIMEOUT` 内响应。检查 bridge 和浏览器控制台日志，并确认扩展 WebSocket 没有被过期连接替换。

### 锁冲突

`TAB_SWITCH_LOCK_CONFLICT` 会提供 `lockOwnerSessionId`、`expiresAt` 和 `remainingMs`。等待过期，或让所有者调用 `zen_release_tab_switch_lock`。

### 标签页未回收

会话拥有的标签页会在 bridge 空闲超时和扩展清理消息后清理。确认扩展已连接，为独立客户端使用不同 session id，并检查 `ZEN_MCP_SESSION_IDLE_TIMEOUT`。

### 网络主体不可用

`unavailable_binary`、`unavailable_too_large`、`unavailable_stream` 和 `unavailable_decompression` 表示主体捕获限制或运行时支持情况，不代表原页面响应失败。重放是真实请求，可能产生服务端副作用。

## 安全运行

- 重放和破坏性工作区操作使用可丢弃标签页和测试账号。
- 除非受控调试需要检查捕获的 Cookie 请求头，否则保持 `filterNetworkCookies=true`。
- 不要让独立客户端共享一个 MCP session id。
- 不要将 bridge 暴露到 localhost 之外。

## 恢复

使用 Git 恢复源码和文档，通过 `build:all` 重新构建，重新加载 XPI，然后重启 bridge 或用户服务。浏览器状态由 Zen Browser 所有，不由 zen-mcp 备份。
