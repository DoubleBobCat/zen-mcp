# Architecture Design - Zen MCP Browser Automation

[English](Architecture.md) | [简体中文](Architecture_zh.md)

## System layers

```text
MCP Client
  -> Go Bridge: WebSocket or POST /mcp
  -> Extension WebSocket backend
  -> background.js MCP router
  -> WebExtension APIs or browser.zenMcp Experiment API
  -> Zen Browser
```

### Transport layer

`src/go-bridge/` owns HTTP serving, WebSocket upgrades, JSON-RPC id
correlation, HTTP session headers, timeout handling, and session idle cleanup.
It does not own tool metadata or browser operations.

### Extension layer

`src/extension/background.js` owns the 46 advertised tools in total (43 core
and 3 diagnostic), schemas, dispatch,
explicit tab validation, session tab tracking, switch locking, and search tab
cleanup. `bridge-connection.js` owns reconnect lifecycle. `network-capture.js`
owns in-memory network sessions and replay. `content-script.js` executes page
DOM operations when available.

### Privileged browser layer

`src/extension/experiment/api.js` and `schema.json` expose privileged Zen
workspace, folder, and top-pinned-tab operations through `browser.zenMcp`.

### Debug frontend

`src/debug-frontend/` is copied into the Go bridge build workspace and embedded
in the bridge binary. It is served at `/` and uses the same external WebSocket
transport as MCP clients.

## State ownership

- Go bridge: MCP transport sessions, pending request targets, and timeout
  timers.
- Extension background: session-to-tab ownership, the active-tab lock, search
  temporary tabs, and tool dispatch.
- Network capture manager: bounded request/response records and one-shot replay
  rules.
- Zen Browser: workspace, folder, pinned-tab, and browser-session state.

No state is persisted by zen-mcp.

## Concurrency boundaries

- Requests for the same tab are serialized in the extension.
- Workspace structure mutations use a workspace-level queue.
- Active-tab operations use one expiring global lock.
- The bridge keeps HTTP and WebSocket response targets isolated.

## Generated artifacts

The build process generates `build/go-bridge/dist/`,
`build/go-bridge/release/`, `build/extension/dist/extension/`, and the XPI.
These are build outputs, not source-of-truth files.

## Build and delivery boundary

The extension is packaged once as a platform-independent XPI. The Go bridge
is compiled with `CGO_ENABLED=0` for `linux/amd64`, `darwin/amd64`, and
`windows/amd64`. Repository scripts provide test, build, and release units that
are called by both GitHub Actions and Gitea Actions; tag CD jobs publish the
artifacts only after CI succeeds.
