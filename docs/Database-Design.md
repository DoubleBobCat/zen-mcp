# Database Design - Zen MCP Browser Automation

## Applicability

zen-mcp has no project-owned database and no persistent storage layer. Zen
Browser remains the owner of workspace, folder, pinned-tab, and session state.

## Transient models

### MCP session

The Go bridge keeps `sessionId`, connection state, last activity, in-flight
request count, and an idle cleanup timer.

### Session tab ownership

The extension keeps a mapping from MCP `sessionId` to operated browser `tabId`
values. Shared tabs remain open until their final active owner expires.

### Tab switch lock

The extension keeps one lock containing owner session id, acquisition time,
expiry time, and explicit/operation-scoped state.

### Network session

The network manager keeps an id, owner session id, tab id, expiry, and bounded
request records. Records contain request/response metadata and body availability
state. Captured credential headers are projected out before MCP responses.

### Replay rule

Response overrides are held as one-shot, exact URL/method rules and are removed
after use or expiry.

## Lifecycle

All models are discarded when the bridge or extension stops. Network state is
also removed when capture stops, the tab closes, the owner session is cleaned,
or the 15-minute limit expires. No migration, backup, indexing, encryption, or
database monitoring is required.
