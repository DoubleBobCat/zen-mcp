# 架构设计：Zen MCP 浏览器自动化

[English](Architecture.md) | [简体中文](Architecture_zh.md)

## 系统分层

```text
MCP Client
  -> Go Bridge：WebSocket 或 POST /mcp
  -> 扩展 WebSocket 后端
  -> background.js MCP 路由器
  -> WebExtension API 或 browser.zenMcp Experiment API
  -> Zen Browser
```

### 传输层

`src/go-bridge/` 负责 HTTP 服务、WebSocket 升级、JSON-RPC id 关联、HTTP session header、超时处理和会话空闲清理，不负责工具元数据或浏览器操作。

### 扩展层

`src/extension/background.js` 负责 46 个工具（43 个核心工具和 3 个诊断工具）的元数据、schema、分发、明确标签页校验、会话标签页跟踪、切换锁和搜索标签页清理。`bridge-connection.js` 负责重连，`network-capture.js` 负责内存网络会话和重放，`content-script.js` 在可用时执行页面 DOM 操作。

### 特权浏览器层

`src/extension/experiment/api.js` 和 `schema.json` 通过 `browser.zenMcp` 提供特权 Zen 工作区、文件夹和顶部置顶标签页操作。

### 调试前端

`src/debug-frontend/` 会被复制到 Go bridge 构建工作区并嵌入二进制，在 `/` 提供与 MCP 客户端相同的外部 WebSocket 传输。

## 状态所有权

- Go bridge：MCP 传输会话、待处理请求目标和超时定时器。
- 扩展后台：会话到标签页的所有权、活动标签页锁、搜索临时标签页和工具分发。
- 网络捕获管理器：有大小限制的请求/响应记录和一次性重放规则。
- Zen Browser：工作区、文件夹、置顶标签页和浏览器会话状态。

zen-mcp 不持久化任何状态。

## 并发边界

- 同一标签页的请求在扩展中串行化。
- 工作区结构变更使用工作区级队列。
- 活动标签页操作使用一个会过期的全局锁。
- bridge 隔离 HTTP 和 WebSocket 响应目标。

## 生成产物

`build/` 下的 bridge、扩展和 XPI 都是构建输出，不是事实来源。必须通过构建流程重新生成。
