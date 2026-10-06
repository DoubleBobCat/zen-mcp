# Zen MCP API 参考

[English](all-tools.md) | [简体中文](all-tools_zh.md)

Zen Browser 自动化的可调用工具。工具名称、字段名称和返回 JSON 保持与运行时及 [OpenAPI 合约](openapi.yaml)一致。

## 状态

- 稳定核心工具：43 个
- 诊断工具：3 个
- 当前已知的未完成工具：无

未在当前运行时注册或暴露的工具必须标记为 `未完成`，不得作为稳定可调用 API 展示。

## 工具清单

### 导航工具

`zen_navigate`、`zen_list_pages`、`zen_search`、`zen_select_page`、`zen_reload`、`zen_new_tab`、`zen_close_tab`

页面目标工具通常使用 `tabId`，并可使用 `workspaceId` 验证工作区归属、使用 `expectedUrl` 拒绝过期页面。`zen_search` 支持 Google、Bing、DuckDuckGo、arXiv、bioRxiv、PubMed 和 Google Scholar，也支持带 `{query}` 与 `{page}` 占位符的 HTTP(S) 搜索地址。

### 检查工具

`zen_snapshot`、`zen_screenshot`、`zen_get_page_text`、`zen_get_form_fields`

截图需要浏览器可见。页面文本和表单字段返回目标页面的 URL 与标题。

### 交互工具

`zen_click`、`zen_fill`、`zen_select_option`、`zen_check`、`zen_press_key`、`zen_fill_form`、`zen_scroll`

这些工具通过 CSS 选择器定位页面元素；`zen_fill_form` 支持批量执行 `fill`、`select`、`check`、`uncheck` 和 `click` 操作。

### 实用工具

`zen_evaluate`、`zen_wait`、`zen_wait_for`、`zen_reconnect`

`zen_evaluate` 在页面上下文执行 JavaScript；`zen_wait_for` 可以等待选择器或文本出现。

### 工作区工具

`zen_list_workspaces`、`zen_list_workspace_tabs`、`zen_move_tab_in_workspace`、`zen_move_tab_to_workspace`、`zen_manage_workspace`、`zen_list_folders`、`zen_manage_folder`、`zen_move_tab_to_folder`、`zen_move_tab_out_of_folder`、`zen_list_top_pinned_tabs`、`zen_manage_top_pinned_tab`

工作区、文件夹和置顶标签的下标均为从零开始，并且只对相应工具返回的列表有效。详细参数、错误和内部 API 说明见[工作区工具 API](workspace-tools_zh.md)。

### 会话和网络工具

`zen_acquire_tab_switch_lock`、`zen_release_tab_switch_lock`、`zen_get_tab_switch_lock`、`zen_network_start`、`zen_network_stop`、`zen_network_list`、`zen_network_get_request`、`zen_network_get_response`、`zen_network_replay`、`zen_network_replay_with_response`

网络会话绑定到 MCP 会话和目标标签页。捕获记录保存在内存中，凭据请求头默认不会返回给 MCP；重放使用浏览器管理的 Cookie，可能产生真实的服务端副作用。

### 诊断工具

`zen_diagnose_experiment`、`zen_diagnose_parent`、`zen_diagnose_ping`

这些工具用于排查扩展 Experiment API 注册、特权父进程 API 和调用连通性。

## 参数约定

- 页面操作需要 `tabId`；`workspaceId` 和 `expectedUrl` 为可选校验字段。
- `zen_select_option` 的 `by` 为 `value` 或 `text`，默认是 `value`。
- `zen_scroll` 的 `direction` 为 `up`、`down`、`left` 或 `right`。
- 网络工具需要匹配的 `networkSessionId`、`tabId` 和所属 MCP 会话。
- `filterNetworkCookies` 默认启用；网络主体受内存大小和运行时解压能力限制。

完整的逐工具参数、返回值和示例请参阅[中文 API 参考](all-tools_zh.md)。
