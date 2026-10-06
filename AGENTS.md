# AGENTS.md

本文件只定义仓库级强约束，并指向承担具体职责的文档。系统架构、工具清单、命令参数和操作步骤不在本文件维护。

## 全局强约束

1. **以文档为准**：开始工作前先阅读 [`docs/README.md`](docs/README.md)，再阅读与任务职责对应的文档。文档与代码冲突时，先更新文档中的事实和约束，再修改实现。
2. **工具状态准确**：任何未注册、未暴露或当前运行路径不可调用的工具，必须在工具名称附近标记为 `未完成`，不得列入已实现或稳定可调用工具清单。
3. **源代码变更必须重新打包**：修改 `src/` 或其他参与构建的源文件后，必须遵循 [`docs/development/workflow.md`](docs/development/workflow.md) 完成重新构建、XPI 重新加载和验证。
4. **禁止手改生成物**：`build/` 下的构建输出、XPI、bridge 发布目录和嵌入的静态资源必须通过构建流程生成，不得直接编辑。
5. **变更保持可验证**：完成修改后运行与变更相关的测试、类型检查或文档校验；若运行环境无法完成验证，必须在结果中说明未执行的检查。
6. **职责文档同步**：工具契约、架构、开发流程、部署或运维行为发生变化时，必须同步更新对应职责文档及其索引。

## 职责文档索引

| 职责 | 权威文档 |
| --- | --- |
| 文档目录、来源和兼容路径 | [`docs/README.md`](docs/README.md) |
| 运行时架构与组件边界 | [`docs/architecture/overview.md`](docs/architecture/overview.md) |
| MCP 工具清单、参数、返回值和状态 | [`docs/api/all-tools.md`](docs/api/all-tools.md) |
| 工作区工具的细节 | [`docs/api/workspace-tools.md`](docs/api/workspace-tools.md) |
| 开发、构建、调试和验证流程 | [`docs/development/workflow.md`](docs/development/workflow.md) |
| 部署、打包、权限和回滚 | [`docs/Deployment.md`](docs/Deployment.md) |
| 运行、故障排查、日志和服务管理 | [`docs/Operation.md`](docs/Operation.md) |
| 需求、架构决策和实施计划 | [`docs/Vision.md`](docs/Vision.md)、[`docs/PRD.md`](docs/PRD.md)、[`docs/SRS.md`](docs/SRS.md)、[`docs/Architecture.md`](docs/Architecture.md)、[`docs/Roadmap.md`](docs/Roadmap.md) |
| 测试计划、协议和数据设计 | [`docs/Test-Plan.md`](docs/Test-Plan.md)、[`docs/specs/`](docs/specs/)、[`docs/Database-Design.md`](docs/Database-Design.md) |
| 阶段适用性决策和协议规格 | [`docs/decisions/applicability.md`](docs/decisions/applicability.md)、[`docs/specs/`](docs/specs/) |
