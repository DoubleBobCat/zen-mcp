# 软件需求规格说明：Zen MCP 浏览器自动化

[English](SRS.md) | [简体中文](SRS_zh.md)

## 运行时需求

- Node.js 18+，用于扩展构建和测试。
- Go 1.22+，用于 bridge 构建和测试。
- 支持临时扩展加载和 Firefox Experiment API 的 Zen Browser。
- 扩展 manifest 必须保留 `tabs`、`activeTab`、`storage`、`webRequest`、`webRequestBlocking`、`cookies` 和 `<all_urls>` 权限。

## MCP 工具需求

- `tools/list` 必须准确暴露 `src/extension/background.js` 注册的工具。
- `tools/call` 必须分发每个已公布的工具，或针对无效运行状态返回标准工具错误。
- 工具 schema 必须拒绝缺少必填字段的请求，并保持当前从零开始的下标约定。
- 页面目标工具必须需要 `tabId`，并可校验 `workspaceId` 和 `expectedUrl`。
- 网络工具必须同时校验 `networkSessionId`、`tabId` 和所属 MCP 会话。

## Bridge 需求

- 默认监听 9222 端口，并支持 JSON 配置或 `ZEN_MCP_PORT` 修改。
- 为每个 HTTP POST 提供一个 JSON-RPC 请求或通知的 `/mcp` 端点。
- 在 `/` 和 `/ws` 提供 WebSocket，并通过 `?type=extension` 识别扩展连接。
- 恢复原始 JSON-RPC id，只将响应路由给原始客户端。
- 对校验、转发、可用性和超时场景返回文档规定的 HTTP 400、405、406、502、503 和 504。

## 状态与安全需求

- 网络记录、bridge 会话、标签页所有权和切换锁只保存在内存中。
- 每个网络会话最多 500 条记录、每个主体最多 1 MiB、会话最长 15 分钟。
- 默认在投影到 MCP 前过滤凭据请求头。
- 重放在内部使用浏览器管理的 Cookie，可能产生真实服务端副作用。
- 会话清理不得关闭仍由其他活动会话拥有的标签页，也不得删除最后一个浏览器标签页。

## 构建需求

- `npm --prefix build/extension run build:all` 必须重新生成 bridge、扩展、三平台静态发布包、发布目录和 XPI。
- Go bridge 发布构建必须使用 `CGO_ENABLED=0` 并产出 Linux、macOS 和 Windows 包。
- GitHub Actions 和 Gitea Actions 必须先测试再构建，CD 只能在版本标签 CI 成功后发布。
- `build/` 下的生成文件不得手动编辑。
- 修改源码后必须重新加载 XPI 并完成相关 Zen Browser 验证。
