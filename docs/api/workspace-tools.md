# Workspace Tools API Reference

[English](workspace-tools.md) | [简体中文](workspace-tools_zh.md)

These workspace APIs are implemented through the privileged `browser.zenMcp` Experiment API. They are callable through the extension bridge and are included in the 43 core tools.

## zen_list_workspaces

List all workspaces with metadata.

**Parameters:** None

**Returns:**
```json
{
  "workspaces": [
    {
      "uuid": "550e8400-e29b-41d4-a716-446655440000",
      "name": "Work",
      "icon": "💼",
      "isActive": true,
      "containerTabId": 0
    }
  ],
  "activeWorkspace": "550e8400-e29b-41d4-a716-446655440000"
}
```

**Internal API:**
- `gZenWorkspaces.getWorkspaces()`
- `gZenWorkspaces.activeWorkspace`

---

## zen_list_workspace_tabs

List all tabs in a specific workspace.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `workspaceId` | string | No | Workspace UUID. Defaults to active workspace. |

**Returns:**
```json
{
  "workspace": {
    "uuid": "550e8400-e29b-41d4-a716-446655440000",
    "name": "Work",
    "icon": "💼"
  },
  "tabs": [
    {
      "index": 0,
      "tabId": 123,
      "windowId": 1,
      "url": "https://example.com",
      "title": "Example",
      "pinned": false,
      "isActive": true
    }
  ]
}
```

**Internal API:**
- `gZenWorkspaces.getWorkspaceFromId(id)`
- `gBrowser.tabs` filtered by `zen-workspace-id` attribute

---

## zen_move_tab_in_workspace

Move a tab to a new position within the same workspace.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `tabIndex` | number | Yes | Current 0-based index of the tab within the workspace |
| `newIndex` | number | Yes | Target 0-based index within the workspace |
| `workspaceId` | string | No | Workspace UUID. Defaults to active workspace. |

**Returns:**
```json
{
  "success": true,
  "tabIndex": 2
}
```

**Errors:**
- `tabIndex` out of bounds
- `newIndex` out of bounds

**Internal API:**
- `gBrowser.moveTabTo(tab, { tabIndex: newIndex })`

---

## zen_move_tab_to_workspace

Move a tab from one workspace to another.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `tabIndex` | number | Yes | 0-based index of the tab within the source workspace |
| `targetWorkspaceId` | string | Yes | UUID of the destination workspace |
| `sourceWorkspaceId` | string | No | UUID of the source workspace. Defaults to active workspace. |

**Returns:**
```json
{
  "success": true,
  "targetWorkspace": {
    "uuid": "550e8400-e29b-41d4-a716-446655440001",
    "name": "Personal",
    "icon": "🏠"
  }
}
```

**Errors:**
- `tabIndex` out of bounds
- `targetWorkspaceId` not found
- Cannot move essential tabs (`zen-essential`)

**Internal API:**
- `gZenWorkspaces.moveTabToWorkspace(tab, targetWorkspaceId)`

---

## zen_manage_workspace

Create, delete, or rename a workspace.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `action` | string | Yes | One of: `"create"`, `"delete"`, `"rename"` |
| `workspaceId` | string | Conditional | Required for `delete` and `rename` |
| `name` | string | Conditional | Required for `create` and `rename` |

**Returns:**

For `create`:
```json
{
  "uuid": "550e8400-e29b-41d4-a716-446655440002",
  "name": "New Workspace",
  "icon": ""
}
```

For `delete`:
```json
{
  "success": true
}
```

For `rename`:
```json
{
  "uuid": "550e8400-e29b-41d4-a716-446655440000",
  "name": "Renamed Workspace"
}
```

**Errors:**
- `action` is invalid
- `workspaceId` not found (for delete/rename)
- Cannot delete the last workspace
- `name` is empty (for create/rename)

**Internal API:**
- create: `gZenWorkspaces.createAndSaveWorkspace(name, undefined, false, 0)`
- delete: `gZenWorkspaces.removeWorkspace(workspaceId)`
- rename: `gZenWorkspaces.saveWorkspace({ ...workspace, name })`

---

## zen_list_folders

List Zen folders in a workspace, including non-placeholder tabs contained by each folder.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `workspaceId` | string | No | Workspace UUID. Defaults to active workspace. |

**Returns:**
```json
{
  "workspace": {
    "uuid": "550e8400-e29b-41d4-a716-446655440000",
    "name": "Work",
    "icon": "💼"
  },
  "folders": [
    {
      "id": "folder-id",
      "title": "Research",
      "index": 0,
      "workspaceId": "550e8400-e29b-41d4-a716-446655440000",
      "collapsed": false,
      "isLiveFolder": false,
      "parentId": null,
      "level": 0,
      "tabs": [
        {
          "index": 0,
          "url": "https://example.com",
          "title": "Example",
          "pinned": true,
          "isActive": false
        }
      ]
    }
  ]
}
```

**Errors:**
- Workspace not found
- Zen folder APIs are not available in the current window

**Internal API:**
- `gZenWorkspaces.getWorkspaceFromId(id)`
- `gBrowser.tabContainer.querySelectorAll("zen-folder")` filtered by `zen-workspace-id`
- Folder placeholder tabs marked `zen-empty-tab` are excluded from `tabs`

---

## zen_manage_folder

Create, rename, delete, or unpack a Zen folder.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `action` | string | Yes | One of: `"create"`, `"rename"`, `"delete"`, `"unpack"` |
| `workspaceId` | string | No | Workspace UUID. Defaults to active workspace. |
| `folderId` | string | Conditional | Required for `rename`, `delete`, and `unpack` |
| `title` | string | Conditional | Required for `create` and `rename` |
| `tabIndices` | array of integers | No | Workspace tab indices to include when creating a folder |

**Returns:**

For `create` and `rename`:
```json
{
  "id": "folder-id",
  "title": "Research",
  "index": 0,
  "workspaceId": "550e8400-e29b-41d4-a716-446655440000",
  "collapsed": false,
  "isLiveFolder": false,
  "parentId": null,
  "level": 0,
  "tabs": []
}
```

For `delete` and `unpack`:
```json
{
  "success": true
}
```

**Errors:**
- `action` is invalid
- Workspace not found
- Zen folder APIs are not available in the current window
- `folderId` is missing or not found for `rename`, `delete`, or `unpack`
- `title` is empty for `create` or `rename`
- `tabIndices` contains an out-of-bounds workspace tab index
- Cannot move essential tabs or Zen folder placeholder tabs into a new folder

**Internal API:**
- create: `gZenFolders.createFolder(selectedTabs, { label, workspaceId, collapsed: false })`
- rename: set `folder.name` and `folder.label`, then dispatch `ZenFolderRenamed` when available
- delete: `folder.delete()`
- unpack: `folder.unpackTabs()`
- Tab selection uses `gBrowser.tabs` filtered by `zen-workspace-id`

---

## zen_move_tab_to_folder

Move a workspace tab into a Zen folder.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `tabIndex` | integer | Yes | 0-based index from `zen_list_workspace_tabs` |
| `folderId` | string | Yes | Target folder id |
| `workspaceId` | string | No | Workspace UUID. Defaults to active workspace. |

**Returns:**
```json
{
  "success": true,
  "folder": {
    "id": "folder-id",
    "title": "Research",
    "index": 0,
    "workspaceId": "550e8400-e29b-41d4-a716-446655440000",
    "collapsed": false,
    "isLiveFolder": false,
    "parentId": null,
    "level": 0,
    "tabs": [
      {
        "index": 0,
        "url": "https://example.com",
        "title": "Example",
        "pinned": false,
        "isActive": false
      }
    ]
  }
}
```

**Errors:**
- Workspace not found
- `tabIndex` out of bounds for the workspace tab list
- `folderId` is missing or not found
- Cannot move essential tabs or Zen folder placeholder tabs
- Cannot move tabs into live folders

**Internal API:**
- `gBrowser.tabs` filtered by `zen-workspace-id`
- `gBrowser.tabContainer.querySelectorAll("zen-folder")` filtered by `zen-workspace-id`
- `folder.addTabs([tab])`

---

## zen_move_tab_out_of_folder

Move a folder tab out of its Zen folder while keeping the tab open.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `folderId` | string | Yes | Source folder id |
| `tabIndex` | integer | Yes | 0-based index from the folder's `tabs` list |
| `workspaceId` | string | No | Workspace UUID. Defaults to active workspace. |

**Returns:**
```json
{
  "success": true,
  "tab": {
    "index": 0,
    "url": "https://example.com",
    "title": "Example",
    "pinned": false,
    "isActive": false
  }
}
```

**Errors:**
- Workspace not found
- `folderId` is missing or not found
- `tabIndex` out of bounds for the folder tab list
- Cannot move essential tabs or Zen folder placeholder tabs

**Internal API:**
- `gBrowser.tabContainer.querySelectorAll("zen-folder")` filtered by `zen-workspace-id`
- Folder placeholder tabs marked `zen-empty-tab` are excluded from the source tab list
- `gBrowser.ungroupTab(tab)`

---

## zen_list_top_pinned_tabs

List top pinned tabs in a workspace, excluding folder-contained tabs, essentials, placeholder tabs, and split-view grouped tabs.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `workspaceId` | string | No | Workspace UUID. Defaults to active workspace. |

**Returns:**
```json
{
  "workspace": {
    "uuid": "550e8400-e29b-41d4-a716-446655440000",
    "name": "Work",
    "icon": "💼"
  },
  "tabs": [
    {
      "index": 0,
      "url": "https://example.com",
      "title": "Example",
      "pinned": true,
      "isActive": false
    }
  ]
}
```

**Errors:**
- Workspace not found

**Internal API:**
- `gZenWorkspaces.pinnedTabsContainer` for the active workspace
- `gZenWorkspaces.workspaceElement(workspaceId)?.pinnedTabsContainer` for other workspaces when available
- Fallback to `gBrowser.tabs` filtered by `zen-workspace-id`
- Excludes tabs with `zen-essential`, `zen-empty-tab`, Zen folder groups, or split-view groups

---

## zen_manage_top_pinned_tab

Pin, unpin, or move a top pinned tab.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `action` | string | Yes | One of: `"pin"`, `"unpin"`, `"move"` |
| `tabIndex` | integer | Yes | For `pin`, index from `zen_list_workspace_tabs`; for `unpin` and `move`, index from `zen_list_top_pinned_tabs` |
| `newIndex` | integer | Conditional | Required for `move`; target index in `zen_list_top_pinned_tabs` |
| `workspaceId` | string | No | Workspace UUID. Defaults to active workspace. |

**Returns:**
```json
{
  "success": true,
  "tabIndex": 0
}
```

**Errors:**
- `action` is invalid
- Workspace not found
- `tabIndex` out of bounds for the relevant source list
- `newIndex` is missing or out of bounds for `move`
- Cannot move essential tabs or Zen folder placeholder tabs
- Cannot top-pin a tab while it is inside a Zen folder
- Target tab not found in the global tab list for `move`

**Internal API:**
- pin: `gBrowser.pinTab(tab)`, set `zen-workspace-id`, and call `gZenWorkspaces.moveTabToWorkspace(tab, workspaceId)` when available
- unpin: `gBrowser.unpinTab(tab)` and set `zen-workspace-id`
- move: resolve target from top pinned tabs, find its global `gBrowser.tabs` index, then call `gBrowser.moveTabTo(tab, { tabIndex })`
- Top pinned tab lists exclude essentials, folder-contained tabs, placeholder tabs, and split-view grouped tabs
