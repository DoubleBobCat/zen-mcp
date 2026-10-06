# 开发流程

[English](workflow.md) | [简体中文](workflow_zh.md)

## 前置条件

- Node.js 18+
- Go 1.22+
- 用于发布打包的 `zip` 和 `tar`
- Zen Browser
- 支持临时扩展加载的 Firefox/Zen 环境

## 安装依赖与验证

```bash
npm --prefix build/extension install
npm --prefix build/extension run test
npm --prefix build/extension run bridge:test
npm --prefix build/extension run typecheck
```

## 构建和打包

```bash
npm --prefix build/extension run bridge:build
npm --prefix build/extension run bridge:build:all
npm --prefix build/extension run build:extension
npm --prefix build/extension run build
npm --prefix build/extension run build:all
```

`bridge:build` 构建本地 Linux bridge；`bridge:build:all` 使用 `CGO_ENABLED=0` 构建 Linux、macOS 和 Windows 静态包；`build:extension` 构建扩展；`build:all` 执行跨平台 bridge、扩展和 XPI 打包。

自动化单元包括：`ci:test`（Node、Go、类型检查和文档验证）、`ci:build`（跨平台构建和 XPI 打包）以及 `ci:release`（验证发布目录）。

## 运行 bridge

```bash
npm --prefix build/extension run bridge
npm --prefix build/extension run server
```

Go bridge 默认监听 9222 端口。外部 WebSocket 客户端使用 `ws://localhost:9222`，Streamable HTTP MCP 客户端使用 `http://localhost:9222/mcp`，扩展后端使用 `ws://localhost:9222?type=extension`，调试前端由同一端口提供。配置文件为 `${XDG_CONFIG_HOME:-~/.config}/zen-mcp/config.json`，可通过 `--config` 或 `ZEN_MCP_CONFIG` 覆盖。`server` 是 `bridge` 的兼容别名。

## 调试前端

1. 运行 `npm --prefix build/extension run build:all`。
2. 在 Zen Browser 中加载生成的扩展。
3. 运行 `npm --prefix build/extension run bridge`。
4. 确认扩展设置中的 bridge URL 为 `ws://localhost:9222?type=extension`。
5. 打开 `http://localhost:9222/`。

调试前端源码位于 `src/debug-frontend/`，构建时会复制到 `build/go-bridge/work/` 并嵌入 Go bridge。

## 生成文件

不要手动编辑 `build/` 下的生成文件。修改源码后运行 `npm --prefix build/extension run build:all`，重新加载生成的 XPI，并完成相关 Zen Browser 验证。
