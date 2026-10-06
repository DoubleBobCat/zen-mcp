# 工作区工具 API 参考

[English](workspace-tools.md) | [简体中文](workspace-tools_zh.md)

这些工作区 API 通过特权 `browser.zenMcp` Experiment API 实现，由扩展 bridge 提供，并计入 43 个核心工具。

## 工具

| 工具 | 说明 |
| --- | --- |
| `zen_list_workspaces` | 列出所有工作区及其元数据。 |
| `zen_list_workspace_tabs` | 列出指定工作区中的标签页；`workspaceId` 默认为当前工作区。 |
| `zen_move_tab_in_workspace` | 在同一工作区内移动标签页；需要 `tabIndex` 和 `newIndex`。 |
| `zen_move_tab_to_workspace` | 将标签页移动到另一个工作区；需要 `targetWorkspaceId`。 |
| `zen_manage_workspace` | 创建、删除或重命名工作区。 |
| `zen_list_folders` | 列出工作区中的 Zen 文件夹及其非占位标签页。 |
| `zen_manage_folder` | 创建、重命名、删除或展开 Zen 文件夹。 |
| `zen_move_tab_to_folder` | 将工作区标签页移入指定文件夹。 |
| `zen_move_tab_out_of_folder` | 将文件夹中的标签页移出，同时保持标签页打开。 |
| `zen_list_top_pinned_tabs` | 列出工作区顶部置顶标签页。 |
| `zen_manage_top_pinned_tab` | 置顶、取消置顶或移动顶部置顶标签页。 |

## 通用约定

- `workspaceId` 为可选的工作区 UUID，缺省使用当前工作区。
- 所有列表下标均为从零开始，并且只对对应列表有效。
- 工作区和文件夹不存在、下标越界、目标参数缺失或操作会影响 Zen 特殊标签页时，工具会返回错误。
- 不能删除最后一个工作区，不能移动 essential 标签页或文件夹占位标签页。
- 文件夹操作不能将标签页移入 live folder；文件夹列表会排除 `zen-empty-tab` 占位标签页。

逐工具的返回示例、错误列表和内部 Zen API 调用见[中文工作区 API 参考](workspace-tools_zh.md)。
