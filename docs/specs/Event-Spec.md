# Event Specification

[English](Event-Spec.md) | [简体中文](Event-Spec_zh.md)

## Public events

The current runtime does not expose a public MCP event stream or subscription
API. MCP communication is request/response based. No additional event
transport is implemented.

## Internal lifecycle events

The bridge sends the following internal control message to the extension after
session cleanup:

```json
{
  "type": "zen/session-disconnected",
  "sessionId": "session-id"
}
```

The extension also consumes browser lifecycle events such as `tabs.onRemoved`,
WebSocket open/close/error events, and `webRequest` request lifecycle events.
These are implementation details and are not callable MCP events.

## Compatibility rule

Adding a public event or subscription contract requires a new specification,
tool registration, tests, and API documentation before implementation.
