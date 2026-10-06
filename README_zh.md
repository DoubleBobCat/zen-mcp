# zen-mcp

[English](README.md) | [简体中文](README_zh.md)

zen-mcp 通过本地 bridge 和 Zen Browser 扩展暴露浏览器自动化能力。外部 MCP 客户端可通过 WebSocket 或 Streamable HTTP MCP 连接 bridge，扩展后端接收 MCP 请求，并在浏览器上下文中调用 Zen Browser APIs。

## 能力

- 共 46 个可调用 MCP 工具：43 个核心工具和 3 个诊断工具。
- 通过 MCP 自动化控制 Zen Browser。
- 支持 WebSocket MCP：`ws://localhost:9222`，以及 Streamable HTTP MCP：`http://localhost:9222/mcp`。
- 支持导航、检查、交互、网络捕获和工作区管理。
- 调试页面：`http://localhost:9222/`。

工具说明见[全部工具 API](docs/api/all-tools_zh.md)。

## 架构

```text
External MCP Client <-> WebSocket (port 9222) <-> Go Bridge <-> Firefox/Zen Extension Backend <-> Zen Browser APIs
HTTP MCP Client <-> POST /mcp <-> Go Bridge <-> Firefox/Zen Extension Backend <-> Zen Browser APIs
Debug Frontend <-> HTTP/WebSocket via Go Bridge
```

- `src/go-bridge/`：提供 WebSocket、Streamable HTTP MCP 和调试页面服务。
- `src/extension/`：Firefox/Zen 扩展和浏览器自动化库。
- `src/debug-frontend/`：浏览器调试页面源码。

## 安装与验证

```bash
npm --prefix build/extension install
bash scripts/install-git-hooks.sh
npm --prefix build/extension run test
npm --prefix build/extension run bridge:test
npm --prefix build/extension run typecheck
npm --prefix build/extension run build:all
```

`npm --prefix build/extension run build:all` 会生成跨平台通用的 XPI，以及 Linux、macOS、Windows 三个平台的静态 Go bridge 发布包。详见 [Go bridge 发布说明](build/go-bridge/README-zen-mcp-bridge_zh.md) 与 [XPI 安装说明](build/extension/README-xpi_zh.md)。

## 开发命令

```bash
npm --prefix build/extension run bridge:test
npm --prefix build/extension run bridge:build
npm --prefix build/extension run bridge
npm --prefix build/extension run server
npm --prefix build/extension run server:install
npm --prefix build/extension run build
npm --prefix build/extension run build:extension
npm --prefix build/extension run build:all
```

- `npm --prefix build/extension run bridge:test`：运行 Go bridge 测试。
- `npm --prefix build/extension run bridge:build`：构建 Go bridge，并嵌入调试页面。
- `npm --prefix build/extension run bridge:build:all`：构建 Linux、macOS、Windows 三个平台的静态 bridge 发布包。
- `npm --prefix build/extension run bridge`：启动 Go bridge，默认在 9222 端口提供 HTTP 和 WebSocket。
- `npm --prefix build/extension run server`：启动 bridge。
- `npm --prefix build/extension run server:install`：构建发布产物，并将 Go bridge 安装为 systemd user service。
- `npm --prefix build/extension run build`：编译 TypeScript。
- `npm --prefix build/extension run build:extension`：构建扩展到 `build/extension/dist/extension/`。
- `npm --prefix build/extension run build:all`：构建 Go bridge、构建扩展，并将扩展打包到 `build/extension/`。

## 项目结构

```text
zen-mcp/
├── src/                    # go-bridge、debug-frontend、extension 三个源代码目录
├── tests/                  # 跨组件一致性测试
├── docs/                   # 当前实现文档和必需设计文档
├── build/                  # 按组件隔离的依赖和构建产物
├── scripts/                # 构建和发布脚本
└── release/                # 发布模板和安装脚本源码
```

## 文档

- [文档地图](docs/README_zh.md)
- [全部工具 API](docs/api/all-tools_zh.md)
- [工作区工具 API](docs/api/workspace-tools_zh.md)
- [架构概览](docs/architecture/overview_zh.md)
- [开发流程](docs/development/workflow_zh.md)
- [部署说明](docs/Deployment_zh.md)

## 构建输出

- `build/artifacts/`：跨平台通用 XPI，以及 Linux、macOS、Windows 三个平台的静态 bridge 发布包。
- `build/go-bridge/`：Go bridge 构建工作区和 Linux 服务发布目录。
- `build/extension/`：Node 依赖、TypeScript 输出、扩展暂存文件和 `.xpi`。

修改源码后使用 `npm --prefix build/extension run build:all` 重新构建。GitHub Actions 和 Gitea Actions 使用相同的测试、编译和发布单元。

## 调试

1. 运行 `npm --prefix build/extension run build:all`。
2. 在 Zen Browser 中加载生成的扩展。
3. 运行 `npm --prefix build/extension run bridge`。
4. 从 Zen Browser 菜单或扩展弹窗打开扩展设置，确认 bridge URL 为 `ws://localhost:9222?type=extension`。
5. 打开 Go bridge 提供的独立 debug frontend：`http://localhost:9222/`。

debug frontend 连接 `ws://localhost:9222`，可以通过与外部客户端相同的 bridge 路径发送 MCP 请求。

Streamable HTTP MCP endpoint: `http://localhost:9222/mcp`。

## License

GPL-3.0-only，详见 [LICENSE](LICENSE)。
