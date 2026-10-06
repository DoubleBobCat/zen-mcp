# Browser Extension Specification

## Scope

The Firefox-compatible Zen Browser extension is the runtime authority for MCP
tool metadata and dispatch. The Go bridge only transports JSON-RPC messages.

## Package contract

- Manifest version: 2.
- Runtime entry scripts: `index.js`, `bridge-connection.js`,
  `network-capture.js`, and `background.js`.
- Content script: `content-script.js`, loaded at `document_idle` for
  `<all_urls>`.
- Settings page: `settings/index.html`.
- Privileged Experiment API: `browser.zenMcp`, implemented by
  `experiment/api.js` and declared in `experiment/schema.json`.
- Minimum Firefox-compatible version: 115.

## Permissions

The current manifest requests `tabs`, `activeTab`, `storage`, `webRequest`,
`webRequestBlocking`, `cookies`, and `<all_urls>`. These permissions support
explicit tab targeting, settings persistence, network capture, response
filtering, and browser-managed-cookie replay.

## Bridge contract

The extension connects to `ws://localhost:9222?type=extension` by default.
The URL, reconnect interval, and automatic connection flag are stored in
`browser.storage.local` as `bridgeSettings`. The default reconnect interval is
5 seconds and the minimum accepted interval is 500 milliseconds.

## Runtime ownership

- `background.js` owns `tools/list`, `tools/call`, session tab tracking, the
  active-tab switch lock, search cleanup, and dispatch to browser APIs.
- `network-capture.js` owns in-memory request/response capture and replay.
- `experiment/api.js` owns privileged Zen workspace, folder, and pinned-tab
  operations.
- `bridge-connection.js` owns extension WebSocket lifecycle and reconnects.

The contract reflects the files packaged by the current build script.
