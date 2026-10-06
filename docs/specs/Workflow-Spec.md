# MCP Request Workflow Specification

## Request lifecycle

1. An external MCP client connects through WebSocket or sends one JSON-RPC
   message to `POST /mcp`.
2. The Go bridge assigns or reuses a session id, rewrites request ids for
   correlation, and forwards the message to the extension WebSocket.
3. The extension background validates the tool schema and dispatches the call
   to WebExtension APIs, the Experiment API, or the in-memory network manager.
4. The bridge restores the original request id and returns the response to the
   originating client.

## Session workflow

- WebSocket connections receive a generated session id for their lifetime.
- HTTP clients use `MCP-Session-Id`; the legacy
  `X-Zen-MCP-Session-ID` header is also accepted.
- The bridge sends `_zenMcpSessionId` and
  `_zenMcpSwitchLockTimeout` as internal message metadata.
- Disconnected sessions are cleaned after the configured idle timeout. The
  extension then removes tabs owned only by that session and releases its lock.

## Error workflow

- Invalid HTTP JSON or JSON-RPC shape: HTTP `400`.
- Unsupported HTTP method: HTTP `405`.
- An `Accept` header that excludes JSON: HTTP `406`.
- Extension unavailable: HTTP `503`.
- Forwarding failure: HTTP `502`.
- Extension timeout: HTTP `504`.
- Tool failures are returned as MCP tool results with `isError: true`.

## Notification workflow

JSON-RPC notifications are forwarded without creating a pending response. The
HTTP endpoint returns `202 Accepted` after forwarding succeeds.
