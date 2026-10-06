# Operation - Zen MCP Browser Automation

## Start and inspect

Foreground bridge:

```bash
npm --prefix build/extension run bridge
```

User service:

```bash
systemctl --user status zen-mcp-bridge.service
systemctl --user restart zen-mcp-bridge.service
journalctl --user -u zen-mcp-bridge.service
```

The bridge logs client connect/disconnect events, extension lifecycle events,
session cleanup, forwarding failures, and HTTP timeout conditions to its
process output or journal.

## Endpoints

- Debug frontend: `http://localhost:9222/`
- External WebSocket MCP: `ws://localhost:9222` or `/ws`
- Extension WebSocket: `ws://localhost:9222?type=extension`
- Streamable HTTP MCP: `POST http://localhost:9222/mcp`

## Troubleshooting

### Extension unavailable

HTTP calls return `503` and WebSocket calls return an `Extension not connected`
JSON-RPC error. Confirm the XPI is loaded, the extension setting uses the
extension URL, and the bridge is listening on the configured port.

### HTTP timeout

HTTP `504` means the extension did not answer within `ZEN_MCP_HTTP_TIMEOUT`.
Inspect bridge and browser console logs, then verify the extension WebSocket
has not been replaced by a stale connection.

### Lock conflict

`TAB_SWITCH_LOCK_CONFLICT` identifies `lockOwnerSessionId`, `expiresAt`, and
`remainingMs`. Wait for expiry or have the owning client call
`zen_release_tab_switch_lock`.

### Tabs not reclaimed

Session-owned tabs are cleaned after the bridge idle timeout and extension
cleanup message. Verify the extension is connected, use distinct session ids
for independent clients, and inspect `ZEN_MCP_SESSION_IDLE_TIMEOUT`.

### Network body unavailable

`unavailable_binary`, `unavailable_too_large`, `unavailable_stream`, and
`unavailable_decompression` describe body capture limits or runtime support.
They do not imply that the original page response failed. Replay is a real
request and may have server-side effects.

## Safe operation

- Use disposable tabs and test accounts for replay and destructive workspace
  operations.
- Keep `filterNetworkCookies=true` unless a controlled debugging session needs
  to inspect captured cookie headers.
- Do not share one MCP session id between independent clients.
- Do not expose the bridge outside localhost.

## Recovery

Use Git to restore source and documentation, rebuild with `build:all`, reload
the XPI, and restart the bridge or user service. Browser state remains owned by
Zen Browser and is not backed up by zen-mcp.
