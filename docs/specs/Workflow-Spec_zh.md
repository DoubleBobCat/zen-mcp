# MCP 请求工作流规格

[English](Workflow-Spec.md) | [简体中文](Workflow-Spec_zh.md)

## 请求生命周期

1. 外部 MCP 客户端通过 WebSocket 连接，或向 `POST /mcp` 发送一条 JSON-RPC 消息。
2. Go bridge 分配或复用 session id，重写请求 id 以便关联，并将消息转发到扩展 WebSocket。
3. 扩展后台校验工具 schema，并将调用分发到 WebExtension API、Experiment API 或内存网络管理器。
4. bridge 恢复原始请求 id，并将响应返回给发起请求的客户端。

## 会话工作流

- WebSocket 连接在其生命周期内获得生成的 session id。
- HTTP 客户端使用 `MCP-Session-Id`；同时接受旧版 `X-Zen-MCP-Session-ID` 请求头。
- bridge 将 `_zenMcpSessionId` 和 `_zenMcpSwitchLockTimeout` 作为内部消息元数据发送。
- 断开的会话在配置的空闲超时后清理，扩展随后移除仅由该会话拥有的标签页并释放锁。

## 错误工作流

- 无效 HTTP JSON 或 JSON-RPC 结构：HTTP `400`。
- 不支持的 HTTP 方法：HTTP `405`。
- `Accept` 请求头排除 JSON：HTTP `406`。
- 扩展不可用：HTTP `503`。
- 转发失败：HTTP `502`。
- 扩展超时：HTTP `504`。
- 工具失败以 `isError: true` 的 MCP 工具结果返回。

## 通知工作流

JSON-RPC 通知会被转发，但不会创建待处理响应。HTTP 端点在转发成功后返回 `202 Accepted`。
