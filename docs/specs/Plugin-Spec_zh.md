# 浏览器扩展规格

[English](Plugin-Spec.md) | [简体中文](Plugin-Spec_zh.md)

## 范围

Firefox 兼容的 Zen Browser 扩展是 MCP 工具元数据和分发的运行时权威。Go bridge 只负责传输 JSON-RPC 消息。

## 包契约

- Manifest 版本：2。
- 运行时入口脚本：`index.js`、`bridge-connection.js`、`network-capture.js` 和 `background.js`。
- 内容脚本：`content-script.js`，在 `document_idle` 时针对 `<all_urls>` 加载。
- 设置页面：`settings/index.html`。
- 特权 Experiment API：`browser.zenMcp`，由 `experiment/api.js` 实现并在 `experiment/schema.json` 声明。
- 最低 Firefox 兼容版本：115。

## 权限

当前 manifest 请求 `tabs`、`activeTab`、`storage`、`webRequest`、`webRequestBlocking`、`cookies` 和 `<all_urls>`。这些权限支持明确标签页目标、设置持久化、网络捕获、响应过滤和浏览器管理的 Cookie 重放。

## Bridge 契约

扩展默认连接 `ws://localhost:9222?type=extension`。URL、重连间隔和自动连接开关保存在 `browser.storage.local` 的 `bridgeSettings` 中。默认重连间隔为 5 秒，接受的最小间隔为 500 毫秒。

## 运行时所有权

- `background.js` 负责 `tools/list`、`tools/call`、会话标签页跟踪、活动标签页切换锁、搜索清理和浏览器 API 分发。
- `network-capture.js` 负责内存请求/响应捕获和重放。
- `experiment/api.js` 负责特权 Zen 工作区、文件夹和置顶标签页操作。
- `bridge-connection.js` 负责扩展 WebSocket 生命周期和重连。

该契约对应当前构建脚本打包的文件。
