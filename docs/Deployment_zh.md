# 部署、打包与回滚

[English](Deployment.md) | [简体中文](Deployment_zh.md)

## 部署模型

zen-mcp 是由 Zen Browser 扩展和 Go bridge 组成的本地部署，不部署托管服务、容器、远程端点或项目自有数据存储。

```text
MCP 客户端 -> localhost:9222 Go bridge -> Zen Browser 扩展 -> Zen Browser APIs
```

## 构建和打包

```bash
npm --prefix build/extension install
npm --prefix build/extension run test
npm --prefix build/extension run bridge:test
npm --prefix build/extension run typecheck
npm --prefix build/extension run build:all
```

`build:all` 使用 `CGO_ENABLED=0` 构建 Linux、macOS 和 Windows bridge，嵌入调试前端，构建跨平台扩展并生成 XPI。生成的文件包括 `build/artifacts/` 中的三个 bridge 包和一个 XPI。不要手动编辑这些路径。

## 加载和运行

1. 在 Zen Browser 中加载生成的 XPI。
2. 确认扩展 bridge URL 为 `ws://localhost:9222?type=extension`。
3. 运行 `npm --prefix build/extension run bridge`。
4. 验证 `http://localhost:9222/`、`ws://localhost:9222` 和 `http://localhost:9222/mcp`。

## Linux 用户服务

完成 `build:all` 后运行：

```bash
npm --prefix build/extension run server:install
```

安装器会将二进制文件放在 `~/.local/bin/zen-mcp-bridge`，将配置放在 `${XDG_CONFIG_HOME:-~/.config}/zen-mcp/config.json`，并将用户单元放在 `${XDG_CONFIG_HOME:-~/.config}/systemd/user/`。不需要 root 权限。没有 systemd user service 时，可以使用 `--config <path>` 直接运行二进制文件。

## GitHub 和 Gitea 自动化

`.github/workflows/ci.yml` 和 `.gitea/workflows/ci.yml` 在 push 和 pull request 上运行相同的测试和构建单元。标签构建只有在 CI 成功后才由 CD 工作流发布对应产物。

## 配置

配置优先级为内置默认值、JSON 文件、环境变量。支持 `ZEN_MCP_CONFIG`、`ZEN_MCP_PORT`、`ZEN_MCP_HTTP_TIMEOUT`、`ZEN_MCP_SESSION_IDLE_TIMEOUT` 和 `ZEN_MCP_SWITCH_LOCK_TIMEOUT`。

## 回滚

停止 bridge 或 systemd user service，重新加载已知可用的 XPI，并恢复已知可用的源码版本后通过构建流程重新生成产物。
