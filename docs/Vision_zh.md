# 愿景：Zen MCP 浏览器自动化

[English](Vision.md) | [简体中文](Vision_zh.md)

## 项目目标

zen-mcp 为 Zen Browser 提供本地 MCP 访问能力。MCP 客户端连接本地 Go bridge，bridge 将 JSON-RPC 转发给 Firefox 兼容的 Zen Browser 扩展，扩展执行浏览器 API 和特权 Zen API。

## 当前能力

- `ws://localhost:9222` 上的 WebSocket MCP。
- `http://localhost:9222/mcp` 上的 Streamable HTTP MCP。
- `http://localhost:9222/` 上的本地调试前端。
- 43 个核心浏览器、工作区、网络和会话工具，以及 3 个诊断工具。
- 明确的标签页目标、工作区校验、会话清理和全局活动标签页切换锁。
- 内存网络捕获、凭据安全投影、浏览器管理的 Cookie 重放和一次性响应覆盖。

## 边界

- Go bridge 负责传输和请求关联。
- 扩展负责 MCP 工具元数据和分发。
- Experiment API 负责特权 Zen 工作区、文件夹和置顶标签页操作。
- zen-mcp 不保存项目自有的持久浏览器数据。
- bridge 仅面向本机；远程部署和多浏览器路由不属于当前实现。

## 成功标准

- 公共文档只列出当前运行时已注册且可调用的工具。
- WebSocket 和 HTTP 客户端访问同一个扩展工具权威。
- XPI 和 bridge 发布产物可以从源码重新构建。
- 测试、类型检查、bridge 测试和文档验证描述同一份实现。
- 扩展生成一个跨平台 XPI，bridge 通过 GitHub Actions 和 Gitea Actions 共用的构建单元生成 Linux、macOS 和 Windows 包。
