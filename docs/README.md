# Documentation

`AGENTS.md` 只保留仓库级强约束和职责文档索引。本目录只保存当前实现对应的文档和 documentation-first-engineering 要求的阶段文档；不保留历史归档、过程计划或验证缓存。职责发生变化时，先更新权威文档，再同步本索引和 `AGENTS.md` 的链接。

## Current Documentation

| 职责 | 权威文档 |
| --- | --- |
| MCP 工具清单、参数、返回值和状态 | [`docs/api/all-tools.md`](api/all-tools.md) |
| 工作区工具细节 | [`docs/api/workspace-tools.md`](api/workspace-tools.md) |
| API 合约 | [`docs/api/openapi.yaml`](api/openapi.yaml) |
| 运行时架构和组件边界 | [`docs/architecture/overview.md`](architecture/overview.md) |
| 开发、构建、调试和验证 | [`docs/development/workflow.md`](development/workflow.md) |
| 部署、打包、权限和回滚 | [`docs/Deployment.md`](Deployment.md) |
| 运行、故障排查、日志和服务管理 | [`docs/Operation.md`](Operation.md) |
| 项目概览和快速开始 | [`README.md`](../README.md) |
| CI/CD、跨平台构建和发布 | [`docs/development/workflow.md`](development/workflow.md)、[`docs/Deployment.md`](Deployment.md) |

## Required Documentation Stages

The following files are the only stage documents retained in this repository:

- [`docs/Vision.md`](Vision.md)
- [`docs/PRD.md`](PRD.md)
- [`docs/SRS.md`](SRS.md)
- [`docs/Architecture.md`](Architecture.md)
- [`docs/specs/`](specs/)
- [`docs/Database-Design.md`](Database-Design.md)
- [`docs/API/openapi.yaml`](API/openapi.yaml)
- [`docs/Roadmap.md`](Roadmap.md)
- [`docs/Test-Plan.md`](Test-Plan.md)
- [`docs/Deployment.md`](Deployment.md)
- [`docs/Operation.md`](Operation.md)

`docs/API/openapi.yaml` is the required documentation-first-engineering path.
`docs/api/openapi.yaml` is the canonical lower-case API reference copy used by
the current API documentation and must remain synchronized with it.

All retained documents describe the current implementation. Future proposals and
superseded designs are not stored under `docs/`.

## Documentation Rules

- If a documented tool is not registered, not exposed, or not callable in the current runtime, mark it as `未完成` beside the tool name and exclude it from stable implemented lists.
- Keep generated artifacts under `build/` out of manual edits; the development and deployment documents define how to regenerate them.
- Keep compatibility paths required by the documentation workflow synchronized with their canonical documents.
