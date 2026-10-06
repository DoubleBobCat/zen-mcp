# Product Requirements Document - Zen MCP Browser Automation

[English](PRD.md) | [简体中文](PRD_zh.md)

## Users

- MCP clients that need to inspect or control a local Zen Browser.
- Agents that need stable tab, workspace, folder, network, and session
  operations.
- Maintainers who need deterministic local build, debug, and release flows.

## User Stories

- As an MCP client, I can inspect and control a selected Zen Browser tab by
  stable `tabId`.
- As an agent, I can manage workspaces, folders, pinned tabs, network sessions,
  and session-owned browser resources.
- As a maintainer, I can use the same registered tool inventory through
  WebSocket, HTTP, and the local debug frontend.

## Product requirements

### Browser automation

- Navigate, reload, create, close, list, and explicitly select tabs.
- Inspect page structure, visible text, form fields, and screenshots.
- Click, fill, select, check, press keys, scroll, evaluate JavaScript, wait, and
  wait for page content.
- Target page operations by `tabId`; optionally validate `workspaceId` and
  `expectedUrl`.

### Search

- Support Google, Bing, DuckDuckGo, arXiv, bioRxiv, PubMed, and Google Scholar.
- Support custom HTTP(S) search URLs with `{query}` and `{page}` placeholders.
- Return the resolved URL, final URL, title, visible text, and close the
  temporary result tab.

### Workspace and Zen structures

- List and manage workspaces.
- List and manage Zen folders and folder membership.
- List and manage top pinned tabs independently from folder tabs and essentials.

### Network and session control

- Capture and inspect requests for a specific tab and MCP session.
- Filter records and read bounded request/response details.
- Replay requests with browser-managed cookies and optionally override the
  replay response.
- Reclaim session-owned tabs after idle cleanup.
- Serialize active-tab operations with an expiring session lock.

### Transport and operations

- Expose the same MCP authority through WebSocket and `POST /mcp`.
- Preserve response isolation for concurrent clients.
- Support local foreground execution and an optional Linux systemd user service.

## Non-goals

- No hosted service, authentication layer, or remote browser control.
- No persistent database owned by zen-mcp.
- No public MCP event subscription API.
- No DevTools Console history tool.
- No multi-window routing or multiple browser instances in one bridge.
