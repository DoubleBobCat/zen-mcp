# 架构概览

[English](overview.md) | [简体中文](overview_zh.md)

zen-mcp 通过本地 bridge 和运行在 Zen Browser 内的 Firefox 兼容扩展，向外部 AI agent 暴露浏览器自动化工具。同一个 bridge 同时支持 WebSocket MCP 和 `POST /mcp` Streamable HTTP MCP。

## 运行时流程

```text
外部 MCP 客户端 <-> WebSocket（9222 端口）<-> Go Bridge <-> Firefox/Zen 扩展后端 <-> Zen Browser APIs
HTTP MCP 客户端 <-> POST /mcp <-> Go Bridge <-> Firefox/Zen 扩展后端 <-> Zen Browser APIs
调试前端 <-> Go Bridge 提供的 HTTP/WebSocket
```

## 组件

- `src/go-bridge/`：当前使用的 Go bridge，默认监听 9222 端口，接收外部 WebSocket、`/mcp` HTTP MCP 和扩展连接，并提供调试前端。
- `src/extension/background.js`：扩展侧 MCP 请求路由，提供工具元数据、分发调用并重连 bridge。
- `src/extension/lib/tools/`：导航、检查、交互、实用和工作区工具实现。
- `src/extension/experiment/`：为 Zen 工作区 API 提供特权 Firefox Experiment API。
- `src/debug-frontend/`：独立调试前端源码，不会打包进扩展 XPI。
- `build/go-bridge/work/static/`：构建时复制并嵌入 Go bridge 的临时调试前端文件。

当前阶段 Go 只负责 bridge；扩展仍是 MCP 工具权威。HTTP 适配器将请求转换为同一条扩展 WebSocket 路径，并把响应路由回原始 HTTP 请求。

## 工具分组

- 核心工具：由 `background.js` 注册和分发，由 WebExtension API、网络捕获管理器和特权 Experiment API 支持。
- 诊断工具：用于排查 Experiment API 注册和特权父进程 API。
- 未完成工具：文档中存在但当前运行路径没有可调用实现的工具，必须标记为 `未完成`。

## 生成产物

`build/artifacts/`、`build/go-bridge/` 和 `build/extension/` 中的文件由构建流程生成，不是事实来源。请使用 `npm --prefix build/extension run build:all` 重新生成，不要手动编辑。
