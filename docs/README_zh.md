# 文档

[English](README.md) | [简体中文](README_zh.md)

`AGENTS.md` 只保留仓库级强约束和职责文档索引。本目录只保存当前实现对应的文档和 documentation-first-engineering 要求的阶段文档；不保留历史归档、过程计划或验证缓存。职责发生变化时，先更新权威文档，再同步本索引和 `AGENTS.md` 的链接。

## 当前文档

| 职责 | 权威文档 |
| --- | --- |
| MCP 工具清单、参数、返回值和状态 | [`docs/api/all-tools_zh.md`](api/all-tools_zh.md) |
| 工作区工具细节 | [`docs/api/workspace-tools_zh.md`](api/workspace-tools_zh.md) |
| API 合约 | [`docs/api/openapi.yaml`](api/openapi.yaml) |
| 运行时架构和组件边界 | [`docs/architecture/overview_zh.md`](architecture/overview_zh.md) |
| 开发、构建、调试和验证 | [`docs/development/workflow_zh.md`](development/workflow_zh.md) |
| 部署、打包、权限和回滚 | [`docs/Deployment_zh.md`](Deployment_zh.md) |
| 运行、故障排查、日志和服务管理 | [`docs/Operation_zh.md`](Operation_zh.md) |
| 项目概览和快速开始 | [`README_zh.md`](../README_zh.md) |
| CI/CD、跨平台构建和发布 | [`docs/development/workflow_zh.md`](development/workflow_zh.md)、[`docs/Deployment_zh.md`](Deployment_zh.md) |

## 必需文档阶段

以下文件是仓库中保留的阶段文档。阶段文档的英文版本仍是规范来源；本中文索引使用其对应的中文阅读版本。

- [`docs/Vision_zh.md`](Vision_zh.md)
- [`docs/PRD_zh.md`](PRD_zh.md)
- [`docs/SRS_zh.md`](SRS_zh.md)
- [`docs/Architecture_zh.md`](Architecture_zh.md)
- [`docs/specs/`](specs/)
- [`docs/Database-Design_zh.md`](Database-Design_zh.md)
- [`docs/API/openapi.yaml`](API/openapi.yaml)
- [`docs/Roadmap_zh.md`](Roadmap_zh.md)
- [`docs/Test-Plan_zh.md`](Test-Plan_zh.md)
- [`docs/Deployment_zh.md`](Deployment_zh.md)
- [`docs/Operation_zh.md`](Operation_zh.md)

`docs/API/openapi.yaml` 是 documentation-first-engineering 要求的路径。
`docs/api/openapi.yaml` 是当前 API 文档使用的小写兼容副本，必须与其保持同步。

所有保留文档都描述当前实现。未来提案和已取代的设计不存放在 `docs/` 下。

## 文档规则

- 未注册、未暴露或当前运行路径不可调用的工具，必须在工具名称旁标记为 `未完成`，并从稳定实现列表中排除。
- `build/` 下的生成产物不得手动编辑；开发和部署文档定义了重新生成方式。
- documentation-first-engineering 要求的兼容路径必须与规范文档保持同步。
