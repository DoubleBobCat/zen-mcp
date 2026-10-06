# Software Requirements Specification - Zen MCP Browser Automation

## Runtime requirements

- Node.js 18 or newer for extension build and tests.
- Go 1.22 or newer for bridge build and tests.
- Zen Browser with temporary extension loading and Firefox Experiment API
  support.
- The extension manifest must retain `tabs`, `activeTab`, `storage`,
  `webRequest`, `webRequestBlocking`, `cookies`, and `<all_urls>` permissions.

## MCP tool requirements

- `tools/list` must expose exactly the tools registered in
  `src/extension/background.js`.
- `tools/call` must dispatch every advertised tool or return a standard tool
  error for invalid runtime state.
- Tool schemas must reject missing required fields and preserve the current
  zero-based index conventions.
- Page-targeted tools must require `tabId` and may validate `workspaceId` and
  `expectedUrl`.
- Network tools must validate the `networkSessionId`, `tabId`, and owning MCP
  session together.

## Bridge requirements

- Listen on port `9222` by default, configurable with JSON configuration or
  `ZEN_MCP_PORT`.
- Serve `/mcp` for one JSON-RPC request or notification per HTTP POST.
- Serve WebSocket clients at `/` and `/ws`; identify the extension connection
  with `?type=extension`.
- Restore original JSON-RPC ids and route responses only to the originating
  client.
- Return HTTP 400, 405, 406, 502, 503, and 504 for the documented validation,
  forwarding, availability, and timeout cases.

## State and safety requirements

- Network records, bridge sessions, tab ownership, and switch locks are
  in-memory only.
- Network capture is bounded to 500 records per session, 1 MiB per body, and a
  15-minute session lifetime.
- Credential headers are filtered by default before MCP projection.
- Replay uses browser-managed cookies internally and may cause real server-side
  effects.
- Session cleanup must not close tabs still owned by another active session or
  remove the final browser tab.

## Build requirements

- `npm --prefix build/extension run build:all` must regenerate the bridge,
  extension, Linux/macOS/Windows static release packages, release layout, and
  XPI.
- Go bridge release builds must use `CGO_ENABLED=0` and produce Linux, macOS,
  and Windows packages.
- GitHub Actions and Gitea Actions must run test before build, and CD must
  publish only after successful CI for a version tag.
- Generated files under `build/` must not be edited manually.
- Changes to source files must be followed by XPI reload and relevant Zen
  Browser verification.
