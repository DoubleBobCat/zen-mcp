# 路线图：Zen MCP 浏览器自动化

[English](Roadmap.md) | [简体中文](Roadmap_zh.md)

## 当前版本基线

当前实现包括：

- 43 个核心工具和 3 个诊断工具。
- WebSocket 和 Streamable HTTP MCP 传输。
- 明确标签页目标和工作区校验。
- 工作区、文件夹和顶部置顶标签页操作。
- 网络捕获、有大小限制的主体检查和重放。
- 会话标签页清理和活动标签页锁。
- 调试前端对受支持列表结果的 CSV 导出。
- Linux、macOS 和 Windows 静态 bridge 发布包，以及可选的 Linux systemd user service 安装。
- GitHub Actions 和 Gitea Actions 测试/构建 CI，以及仅在 CI 成功后发布的 CD。

## 维护工作

1. 保持 `docs/api/all-tools.md`、`docs/api/workspace-tools.md`、OpenAPI 和运行时注册同步。
2. 源码或合约变化后运行文档中记录的自动检查。
3. 源码变化后重新构建并重新加载 XPI。
4. 文件夹或置顶标签页行为随上游变化时，验证 Zen Browser 内部 API 兼容性。

## 明确不在范围内

- DevTools Console 历史访问。
- 公开 MCP 事件订阅。
- 远程或托管部署。
- 多浏览器实例或多窗口路由。
- 项目自有的持久浏览器数据。

未来功能提案在接受并实现前，不放入本仓库当前的 `docs/` 目录。
