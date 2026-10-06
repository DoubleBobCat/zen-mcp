# 测试计划：Zen MCP 浏览器自动化

[English](Test-Plan.md) | [简体中文](Test-Plan_zh.md)

## 自动检查

从仓库根目录运行：

```bash
npm --prefix build/extension run test
npm --prefix build/extension run bridge:test
npm --prefix build/extension run typecheck
npm --prefix build/extension run ci:test
bash /home/doublecat/.config/opencode/skills/documentation-first-engineering/scripts/validate-docs.sh validate .
```

Node 测试验证工具注册、schema、分发、调试前端合约、网络隔离、会话清理、重连行为和项目文档一致性。Go 测试验证 bridge 路由、HTTP 行为、配置、响应关联和嵌入式前端服务。

## 构建验证

源码或构建输入变化时，还要运行：

```bash
npm --prefix build/extension run build:all
npm --prefix build/extension run ci:build
```

确认 XPI、三平台静态 bridge 包、Linux 发布目录和嵌入式调试前端均已生成，并在 Zen Browser 中加载 XPI 后完成手动验证。

## CI/CD 验证

- GitHub Actions 和 Gitea Actions 分别提供测试、构建和发布单元。
- 构建单元必须在测试单元完成后运行。
- CD 只能在版本标签 CI 成功后发布。
- 发布资产包括一个 XPI 和三个静态 Go bridge 包。

## 手动运行时检查

1. 启动 bridge 并确认扩展连接。
2. 通过 WebSocket 和 `POST /mcp` 调用 `initialize`、`tools/list` 和简单的 `tools/call`。
3. 使用非活动的明确 `tabId` 验证页面工具，并确认截图报告选中标签页执行模式。
4. 使用可丢弃的浏览器状态验证工作区、文件夹和顶部置顶标签页的读取与变更。
5. 启动和停止网络会话，检查文本主体、过滤器、凭据投影和浏览器管理的重放。
6. 使用两个会话验证标签页清理和活动标签页锁冲突。
7. 在 bridge 之前启动 Zen Browser，验证扩展无需重启浏览器即可重连。
8. 打开调试前端，为支持的列表结果导出 CSV。

## 安全与测试数据

使用可丢弃标签页、隔离测试站点和非生产账号。重放可能执行真实写操作；文件夹删除、标签页清理和服务安装可能改变本地状态，不得针对重要浏览器工作区。

## 退出标准

- Node、Go、类型检查和文档检查通过。
- 源码变化时 `build:all` 通过。
- 生成的 XPI 可以加载，bridge 可以启动。
- WebSocket、HTTP、调试前端和代表性工具调用可用。
