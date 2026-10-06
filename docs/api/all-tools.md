# Zen MCP API Reference

Callable tools for Zen Browser automation.

## Status

- Stable core tools: 43
- Diagnostic tools: 3
- Unfinished documented tools: none currently known

Tools not registered or exposed by the current runtime must be marked as `未完成` and must not be presented as stable callable APIs.

## Navigation Tools

### zen_navigate

Navigate the explicitly targeted tab to a specified URL.

**Parameters:**
- `url` (string, required): The URL to navigate to
- `tabId` (number, required): WebExtension tab ID of the target tab
- `workspaceId` (string, optional): Workspace used to validate tab ownership
- `expectedUrl` (string, optional): Reject the operation if the tab URL changed

**Returns:**
```json
{
  "success": true,
  "url": "https://example.com"
}
```

### zen_list_pages

List all open tabs with their URLs and titles.

**Parameters:** None

**Returns:**
```json
{
  "pages": [
    {
      "index": 0,
      "tabId": 123,
      "windowId": 1,
      "url": "https://example.com",
      "title": "Example",
      "isActive": true
    }
  ],
  "activePageIndex": 0
}
```

### zen_search

Search a built-in engine or a composed URL, return the loaded result page's visible text, and close the temporary result tab.

**Parameters:**
- `engine` (string, conditional): `google`, `bing`, `duckduckgo`, `arxiv`, `bioarxiv`, `pubmed`, or `google_scholar`.
- `query` (string, conditional): Search terms for a built-in engine or `{query}` in a custom URL.
- `page` (number, optional): One-based page number, default `1`.
- `searchUrl` (string, conditional): An `http`/`https` URL; `{query}` and `{page}` are replaced when present.
- `timeout` (number, optional): Page-load timeout in milliseconds, default `30000`, maximum `120000`.

**Returns:**
```json
{
  "success": true,
  "engine": "google",
  "query": "Zen Browser",
  "page": 1,
  "searchUrl": "https://www.google.com/search?q=Zen%20Browser&start=0",
  "finalUrl": "https://www.google.com/search?q=Zen%20Browser&start=0",
  "title": "Zen Browser - Google Search",
  "text": "...",
  "tabId": 123,
  "closed": true
}
```

### zen_select_page

Switch to a specific tab by index.

**Parameters:**
- `pageIndex` (number, required): 0-based index of the tab to select

**Returns:**
```json
{
  "success": true,
  "pageIndex": 0
}
```

### zen_reload

Reload an explicitly targeted tab.

**Parameters:** `tabId` (number, required), `workspaceId` and `expectedUrl` (optional), `bypassCache` (boolean, optional).

### Network tools

Network tools use a `networkSessionId` bound to a `tabId` and the calling MCP session. `filterNetworkCookies` is enabled by default in the extension settings. Cookie and credential headers are removed from network results while replay uses browser-managed cookies internally.

- `zen_network_start({tabId})`: create a capture session.
- `zen_network_stop({networkSessionId, tabId})`: stop and clear it.
- `zen_network_list({networkSessionId, tabId, category?, urlKeyword?, pageKeyword?, method?, statusCode?, limit?, offset?})`: list filtered summaries.
- `zen_network_get_request({networkSessionId, tabId, recordId})`: read request metadata, headers and body.
- `zen_network_get_response({networkSessionId, tabId, recordId})`: read response metadata, headers and body state.
- `zen_network_replay({networkSessionId, tabId, recordId, headerOverrides?, bodyOverride?})`: replay using browser-managed cookies.
- `zen_network_replay_with_response({networkSessionId, tabId, recordId, responseOverride})`: return a replay result with a one-shot response override. It does not modify a response already being loaded by the original page.

Captured bodies are bounded in memory. Text responses with `Content-Encoding: gzip`, `x-gzip`, or `deflate` are staged through the extension's short-lived privileged temporary-file round trip and decoded when the runtime supports it. Brotli is attempted through the same path, but runtimes without a `DecompressionStream("br")` implementation return `unavailable_decompression`. Binary, streaming, oversized, and failed-decompression bodies return an explicit unavailable state; no temporary path is returned to MCP.

### zen_new_tab

Create a new tab, optionally with a URL.

**Parameters:**
- `url` (string, optional): URL to open in the new tab

**Returns:**
```json
{
  "success": true,
  "tabIndex": 1,
  "url": "https://example.com"
}
```

### zen_close_tab

Close a tab by index.

**Parameters:**
- `tabIndex` (number, required): 0-based index of the tab to close

**Returns:**
```json
{
  "success": true,
  "tabIndex": 0
}
```

**Errors:**
- Cannot close the last tab

---

## Inspection Tools

### zen_snapshot

Get a structural snapshot of the page.

**Parameters:**
- `tabId` (number, required): WebExtension tab ID of the target tab
- `workspaceId` (string, optional): Workspace used to validate tab ownership
- `expectedUrl` (string, optional): Reject if the tab URL changed
- `filter` (string, optional): "all", "interactive", or "form" (default: "all")

**Returns:**
```json
{
  "snapshot": "<div selector=\".container\">Hello</div>",
  "url": "https://example.com",
  "title": "Example"
}
```

### zen_screenshot

Select the target tab and capture a screenshot. Browser visibility is required.

**Parameters:**
- `tabId` (number, required): WebExtension tab ID of the target tab
- `workspaceId` (string, optional): Workspace used to validate tab ownership
- `expectedUrl` (string, optional): Reject if the tab URL changed

**Returns:**
```json
{
  "data": "base64-encoded-image-data",
  "url": "https://example.com",
  "title": "Example"
  ,"executionMode": "selected-tab"
}
```

### zen_get_page_text

Get the visible text content of the page.

**Parameters:**
- `tabId` (number, required): WebExtension tab ID of the target tab
- `workspaceId` (string, optional): Workspace used to validate tab ownership
- `expectedUrl` (string, optional): Reject if the tab URL changed

**Returns:**
```json
{
  "url": "https://example.com",
  "title": "Example",
  "text": "Hello World Welcome to Example..."
}
```

### zen_get_form_fields

List all form fields on the page.

**Parameters:**
- `tabId` (number, required): WebExtension tab ID of the target tab
- `workspaceId` (string, optional): Workspace used to validate tab ownership
- `expectedUrl` (string, optional): Reject if the tab URL changed

**Returns:**
```json
{
  "url": "https://example.com",
  "title": "Example",
  "fields": [
    {
      "name": "username",
      "type": "text",
      "label": "Username",
      "value": "",
      "selector": "#username"
    }
  ]
}
```

---

## Interaction Tools

### zen_click

Click an element by selector.

**Parameters:**
- `tabId` (number, required): WebExtension tab ID of the target tab
- `workspaceId` (string, optional): Workspace used to validate tab ownership
- `expectedUrl` (string, optional): Reject if the tab URL changed
- `selector` (string, required): CSS selector of the element

**Returns:**
```json
{
  "success": true,
  "selector": "#button"
}
```

### zen_fill

Fill an input field.

**Parameters:**
- `tabId` (number, required): WebExtension tab ID of the target tab
- `workspaceId` (string, optional): Workspace used to validate tab ownership
- `expectedUrl` (string, optional): Reject if the tab URL changed
- `selector` (string, required): CSS selector of the input
- `value` (string, required): Value to fill

**Returns:**
```json
{
  "success": true,
  "selector": "#email",
  "value": "user@example.com"
}
```

### zen_select_option

Select an option from a dropdown.

**Parameters:**
- `tabId` (number, required): WebExtension tab ID of the target tab
- `workspaceId` (string, optional): Workspace used to validate tab ownership
- `expectedUrl` (string, optional): Reject if the tab URL changed
- `selector` (string, required): CSS selector of the select element
- `value` (string, required): Option value or text
- `by` (string, optional): "value" or "text" (default: "value")

**Returns:**
```json
{
  "success": true,
  "selector": "#country",
  "value": "US"
}
```

### zen_check

Check or uncheck a checkbox/radio.

**Parameters:**
- `tabId` (number, required): WebExtension tab ID of the target tab
- `workspaceId` (string, optional): Workspace used to validate tab ownership
- `expectedUrl` (string, optional): Reject if the tab URL changed
- `selector` (string, required): CSS selector
- `checked` (boolean, required): true to check, false to uncheck

**Returns:**
```json
{
  "success": true,
  "selector": "#agree",
  "checked": true
}
```

### zen_press_key

Simulate a keyboard key press.

**Parameters:**
- `tabId` (number, required): WebExtension tab ID of the target tab
- `workspaceId` (string, optional): Workspace used to validate tab ownership
- `expectedUrl` (string, optional): Reject if the tab URL changed
- `key` (string, required): Key name (e.g., "Enter", "Tab", "Ctrl+A")

**Returns:**
```json
{
  "success": true,
  "key": "Enter"
}
```

### zen_fill_form

Fill multiple form fields at once.

**Parameters:**
- `tabId` (number, required): WebExtension tab ID of the target tab
- `workspaceId` (string, optional): Workspace used to validate tab ownership
- `expectedUrl` (string, optional): Reject if the tab URL changed
- `fields` (array, required): Array of field actions. Each field requires `selector` and `action`; `action` must be one of `fill`, `select`, `check`, `uncheck`, or `click`. `value` is required for `fill` and `select`.

**Returns:**
```json
{
  "success": true,
  "fields": [
    { "selector": "#name", "action": "fill", "value": "John" },
    { "selector": "#email", "action": "fill", "value": "john@example.com" }
  ]
}
```

### zen_scroll

Scroll the page or an element.

**Parameters:**
- `tabId` (number, required): WebExtension tab ID of the target tab
- `workspaceId` (string, optional): Workspace used to validate tab ownership
- `expectedUrl` (string, optional): Reject if the tab URL changed
- `direction` (string, required): "up", "down", "left", or "right"
- `amount` (number, optional): Scroll amount in pixels (default: 100)
- `selector` (string, optional): Element selector to scroll into view

**Returns:**
```json
{
  "success": true,
  "selector": null,
  "direction": "down"
}
```

---

## Utility Tools

### zen_evaluate

Execute JavaScript in the page context.

**Parameters:**
- `tabId` (number, required): WebExtension tab ID of the target tab
- `workspaceId` (string, optional): Workspace used to validate tab ownership
- `expectedUrl` (string, optional): Reject if the tab URL changed
- `script` (string, required): JavaScript code to execute

**Returns:**
```json
{
  "result": 42,
  "success": true
}
```

### zen_wait

Wait for a specified number of milliseconds.

**Parameters:**
- `milliseconds` (number, required): Time to wait (0-30000)

**Returns:**
```json
{
  "success": true,
  "milliseconds": 1000
}
```

### zen_wait_for

Wait for an element or text to appear.

**Parameters:**
- `tabId` (number, required): WebExtension tab ID of the target tab
- `workspaceId` (string, optional): Workspace used to validate tab ownership
- `expectedUrl` (string, optional): Reject if the tab URL changed
- `selector` (string, optional): CSS selector to wait for
- `text` (string, optional): Text content to wait for
- `timeout` (number, optional): Timeout in milliseconds (default: 5000)

**Returns:**
```json
{
  "success": true,
  "found": true,
  "selector": ".loading-complete"
}
```

### zen_reconnect

Return a successful reconnect operation result. The current implementation
does not expose a separate browser reconnect API.

**Parameters:** None

**Returns:**
```json
{
  "success": true
}
```

---

## Workspace Tools

### zen_list_workspaces

List all workspaces.

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

### zen_list_workspace_tabs

List tabs in a workspace.

**Parameters:**
- `workspaceId` (string, optional): Workspace UUID (defaults to active)

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

### zen_move_tab_in_workspace

Move a tab within a workspace.

**Parameters:**
- `tabIndex` (number, required): Current tab index
- `newIndex` (number, required): Target tab index
- `workspaceId` (string, optional): Workspace UUID

**Returns:**
```json
{
  "success": true,
  "tabIndex": 2
}
```

### zen_move_tab_to_workspace

Move a tab to another workspace.

**Parameters:**
- `tabIndex` (number, required): Tab index in source workspace
- `targetWorkspaceId` (string, required): Target workspace UUID
- `sourceWorkspaceId` (string, optional): Source workspace UUID

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

### zen_manage_workspace

Create, delete, or rename a workspace.

**Parameters:**
- `action` (string, required): "create", "delete", or "rename"
- `workspaceId` (string, conditional): Required for delete/rename
- `name` (string, conditional): Required for create/rename

**Returns:**

For create:
```json
{
  "uuid": "550e8400-e29b-41d4-a716-446655440002",
  "name": "New Workspace",
  "icon": ""
}
```

For delete:
```json
{
  "success": true
}
```

For rename:
```json
{
  "uuid": "550e8400-e29b-41d4-a716-446655440000",
  "name": "Renamed Workspace"
}
```

### zen_list_folders

List Zen folders in a workspace, including non-placeholder tabs contained by each folder.

**Parameters:**
- `workspaceId` (string, optional): Workspace UUID (defaults to active)

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

See [Workspace Tools API Reference](workspace-tools.md#zen_list_folders) for errors and internal API notes.

### zen_manage_folder

Create, rename, delete, or unpack a Zen folder.

**Parameters:**
- `action` (string, required): "create", "rename", "delete", or "unpack"
- `workspaceId` (string, optional): Workspace UUID (defaults to active)
- `folderId` (string, conditional): Required for rename/delete/unpack
- `title` (string, conditional): Required for create/rename
- `tabIndices` (array of integers, optional): Workspace tab indices to include when creating a folder

**Returns:**

For create/rename:
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

For delete/unpack:
```json
{
  "success": true
}
```

See [Workspace Tools API Reference](workspace-tools.md#zen_manage_folder) for errors and internal API notes.

### zen_move_tab_to_folder

Move a workspace tab into a Zen folder.

**Parameters:**
- `tabIndex` (integer, required): Index from `zen_list_workspace_tabs`
- `folderId` (string, required): Target folder id
- `workspaceId` (string, optional): Workspace UUID (defaults to active)

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
    "tabs": []
  }
}
```

See [Workspace Tools API Reference](workspace-tools.md#zen_move_tab_to_folder) for errors and internal API notes.

### zen_move_tab_out_of_folder

Move a folder tab out of its Zen folder while keeping the tab open.

**Parameters:**
- `folderId` (string, required): Source folder id
- `tabIndex` (integer, required): Index from the folder's `tabs` list
- `workspaceId` (string, optional): Workspace UUID (defaults to active)

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

See [Workspace Tools API Reference](workspace-tools.md#zen_move_tab_out_of_folder) for errors and internal API notes.

### zen_list_top_pinned_tabs

List top pinned tabs in a workspace, excluding folder-contained tabs, essentials, placeholder tabs, and split-view grouped tabs.

**Parameters:**
- `workspaceId` (string, optional): Workspace UUID (defaults to active)

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

See [Workspace Tools API Reference](workspace-tools.md#zen_list_top_pinned_tabs) for errors and internal API notes.

### zen_manage_top_pinned_tab

Pin, unpin, or move a top pinned tab.

**Parameters:**
- `action` (string, required): "pin", "unpin", or "move"
- `tabIndex` (integer, required): For pin, index from `zen_list_workspace_tabs`; for unpin/move, index from `zen_list_top_pinned_tabs`
- `newIndex` (integer, conditional): Required for move
- `workspaceId` (string, optional): Workspace UUID (defaults to active)

**Returns:**
```json
{
  "success": true,
  "tabIndex": 0
}
```

See [Workspace Tools API Reference](workspace-tools.md#zen_manage_top_pinned_tab) for errors and internal API notes.

---

## Session and Network Tools

### zen_acquire_tab_switch_lock

Acquire or renew the active-tab switch lock for the calling MCP session.

**Parameters:** `leaseMs` (integer, optional): positive lease duration in milliseconds. The bridge default is 30 seconds.

### zen_release_tab_switch_lock

Release the active-tab switch lock held by the calling MCP session.

**Parameters:** None

### zen_get_tab_switch_lock

Get the current active-tab switch lock state.

**Parameters:** None

### zen_network_start

Start a tab-scoped, session-owned in-memory network capture.

**Parameters:** `tabId` (integer, required)

### zen_network_stop

Stop a network capture and clear its records.

**Parameters:** `networkSessionId` and `tabId` (required)

### zen_network_list

List captured request summaries with optional filters and pagination.

**Parameters:** `networkSessionId`, `tabId` (required); `category`, `urlKeyword`, `pageKeyword`, `method`, `statusCode`, `limit`, and `offset` (optional).

### zen_network_get_request

Read request metadata, headers, and bounded request body for a captured record.

**Parameters:** `networkSessionId`, `tabId`, and `recordId` (required)

### zen_network_get_response

Read response metadata, headers, and body availability state for a captured record.

**Parameters:** `networkSessionId`, `tabId`, and `recordId` (required)

### zen_network_replay

Replay a captured request as a real request using browser-managed cookies.

**Parameters:** `networkSessionId`, `tabId`, and `recordId` (required); `methodOverride`, `headerOverrides`, and `bodyOverride` (optional).

Replay can produce server-side effects. Cookie and authorization values are not supplied by MCP.

### zen_network_replay_with_response

Replay a captured request and apply a one-shot response override to the returned result.

**Parameters:** `networkSessionId`, `tabId`, `recordId`, and `responseOverride` (required)

The override does not modify an original page response that is already loading.

---

## Diagnostic Tools

These tools are implemented for troubleshooting extension and privileged Experiment API registration.

### zen_diagnose_experiment

Inspect extension-side Experiment API registration.

**Parameters:** None

### zen_diagnose_parent

Inspect privileged parent-side Zen API availability.

**Parameters:** None

### zen_diagnose_ping

Verify that privileged Experiment API calls can execute.

**Parameters:** None
