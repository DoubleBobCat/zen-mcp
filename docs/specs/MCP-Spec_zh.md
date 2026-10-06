# MCP 规格：Zen MCP 浏览器自动化

[English](MCP-Spec.md) | [简体中文](MCP-Spec_zh.md)

## 传输

- WebSocket MCP 客户端连接 `ws://localhost:9222` 或 `/ws`。
- 扩展连接 `ws://localhost:9222?type=extension`。
- Streamable HTTP 客户端每次向 `POST http://localhost:9222/mcp` 发送一条 JSON-RPC 请求或通知。
- 调试前端由 `http://localhost:9222/` 提供，并使用外部 WebSocket 路径。

Go bridge 在内部重写请求 id，并为原始客户端恢复 id。工具元数据和分发仍由扩展负责。

## 工具清单

运行时提供 43 个核心工具和 3 个诊断工具。完整参数和结果参考见[全部工具 API](../api/all-tools_zh.md)，OpenAPI 清单见[OpenAPI 文件](../API/openapi.yaml)。

### 核心分组

- 导航和标签页：`zen_navigate`、`zen_reload`、`zen_search`、`zen_list_pages`、`zen_select_page`、`zen_new_tab`、`zen_close_tab`。
- 页面检查和交互：`zen_snapshot`、`zen_screenshot`、`zen_get_page_text`、`zen_get_form_fields`、`zen_click`、`zen_fill`、`zen_select_option`、`zen_check`、`zen_press_key`、`zen_fill_form`、`zen_scroll`。
- 实用工具：`zen_evaluate`、`zen_wait`、`zen_wait_for`、`zen_reconnect`。
- 工作区和 Zen 结构：工作区、文件夹和顶部置顶标签页工具。
- 会话和网络：活动标签页切换锁及网络捕获、查询、主体读取和重放工具。

### 诊断分组

- `zen_diagnose_experiment`
- `zen_diagnose_parent`
- `zen_diagnose_ping`

## 契约规则

- 页面工具需要非负 `tabId`；提供 `workspaceId` 时校验归属，提供 `expectedUrl` 时拒绝过期 URL。
- 工作区和文件夹下标从零开始，并且只对对应工具返回的列表有效。
- 网络工具需要匹配的 `networkSessionId`、`tabId` 和所属 MCP 会话；网络记录只保存在内存中。
- `filterNetworkCookies` 默认开启；MCP 投影默认移除 Cookie 和 authorization 请求头，重放由浏览器内部获取 Cookie。
- 活动标签页操作使用一个会过期的锁；冲突会返回所有者、过期时间和剩余租约。
- 未在运行时注册且可调用的工具必须标记为 `未完成`。当前清单没有此类工具。

## HTTP 行为

| 条件 | 状态 |
| --- | ---: |
| 带 id 的有效请求 | 200 |
| 接受通知 | 202 |
| 无效 JSON 或 JSON-RPC body | 400 |
| 非 POST 方法 | 405 |
| `Accept` 排除 JSON | 406 |
| 转发失败 | 502 |
| 扩展不可用 | 503 |
| 扩展响应超时 | 504 |
