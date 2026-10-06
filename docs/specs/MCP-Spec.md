# MCP Specification - Zen MCP Browser Automation

[English](MCP-Spec.md) | [简体中文](MCP-Spec_zh.md)

## Transport

- WebSocket MCP clients connect to `ws://localhost:9222` or `/ws`.
- The extension connects to `ws://localhost:9222?type=extension`.
- Streamable HTTP clients send one JSON-RPC request or notification per
  `POST http://localhost:9222/mcp`.
- The debug frontend is served at `http://localhost:9222/` and uses the
  external WebSocket path.

The Go bridge rewrites request ids internally and restores the original id for
the originating client. Tool metadata and dispatch remain in the extension.

## Tool inventory

The runtime exposes 43 core tools and 3 diagnostic tools. The complete
parameter and result reference is [all-tools.md](../api/all-tools.md); the
OpenAPI inventory is [openapi.yaml](../API/openapi.yaml).

### Core groups

- Navigation and tab management: `zen_navigate`, `zen_reload`, `zen_search`,
  `zen_list_pages`, `zen_select_page`, `zen_new_tab`, `zen_close_tab`.
- Page inspection and interaction: `zen_snapshot`, `zen_screenshot`,
  `zen_get_page_text`, `zen_get_form_fields`, `zen_click`, `zen_fill`,
  `zen_select_option`, `zen_check`, `zen_press_key`, `zen_fill_form`,
  `zen_scroll`.
- Utilities: `zen_evaluate`, `zen_wait`, `zen_wait_for`, `zen_reconnect`.
- Workspaces and Zen structures: `zen_list_workspaces`,
  `zen_list_workspace_tabs`, `zen_move_tab_in_workspace`,
  `zen_move_tab_to_workspace`, `zen_manage_workspace`, `zen_list_folders`,
  `zen_manage_folder`, `zen_move_tab_to_folder`,
  `zen_move_tab_out_of_folder`, `zen_list_top_pinned_tabs`,
  `zen_manage_top_pinned_tab`.
- Session and network: `zen_acquire_tab_switch_lock`,
  `zen_release_tab_switch_lock`, `zen_get_tab_switch_lock`,
  `zen_network_start`, `zen_network_stop`, `zen_network_list`,
  `zen_network_get_request`, `zen_network_get_response`, `zen_network_replay`,
  `zen_network_replay_with_response`.

### Diagnostic group

- `zen_diagnose_experiment`
- `zen_diagnose_parent`
- `zen_diagnose_ping`

## Contract rules

- Page tools require a non-negative `tabId`; `workspaceId` validates ownership
  when supplied and `expectedUrl` rejects stale URLs.
- Workspace and folder indices are zero-based and local to the list returned by
  the corresponding tool.
- Network tools require the matching `networkSessionId`, `tabId`, and owner
  MCP session. Network records are bounded in memory and are never persisted.
- `filterNetworkCookies` defaults to true. MCP projections remove cookie and
  authorization headers by default; replay obtains cookies internally from the
  browser cookie store.
- Active-tab operations use one expiring lock. Conflicts return the owner,
  expiry, and remaining lease time.
- Tools that are not registered and callable in the runtime must be marked
  `未完成` wherever they are documented. No such tools are listed in this
  current inventory.

## HTTP behavior

| Condition | Status |
| --- | ---: |
| Valid request with id | 200 |
| Notification accepted | 202 |
| Invalid JSON or JSON-RPC body | 400 |
| Non-POST method | 405 |
| `Accept` excludes JSON | 406 |
| Forwarding failure | 502 |
| Extension unavailable | 503 |
| Extension response timeout | 504 |
