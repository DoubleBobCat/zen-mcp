# Vision - Zen MCP Browser Automation

[English](Vision.md) | [简体中文](Vision_zh.md)

## Project goal

zen-mcp provides local MCP access to Zen Browser automation. An MCP client
connects to a local Go bridge, the bridge forwards JSON-RPC to a Firefox-
compatible Zen Browser extension, and the extension executes browser and
privileged Zen APIs.

## Current capability

- WebSocket MCP at `ws://localhost:9222`.
- Streamable HTTP MCP at `http://localhost:9222/mcp`.
- A local debug frontend at `http://localhost:9222/`.
- 43 core browser/workspace/network/session tools and 3 diagnostic tools.
- Explicit tab targeting, workspace validation, session cleanup, and a global
  active-tab switch lock.
- In-memory network capture, credential-safe projections, browser-managed
  cookie replay, and one-shot response overrides.

## Boundaries

- The Go bridge is a transport and request-correlation layer.
- The extension owns MCP tool metadata and dispatch.
- The Experiment API owns privileged Zen workspace, folder, and pinned-tab
  operations.
- zen-mcp stores no project-owned persistent browser data.
- The bridge is local-only; remote deployment and multi-browser routing are not
  part of the current implementation.

## Success criteria

- Public documentation names only tools registered and callable in the current
  runtime.
- WebSocket and HTTP clients reach the same extension tool authority.
- Generated XPI and bridge release artifacts can be rebuilt from source.
- Tests, type checking, bridge tests, and documentation validation describe the
  same implementation.
- The extension produces one platform-independent XPI, while the bridge
  produces static Linux, macOS, and Windows packages through the same build
  unit used by GitHub Actions and Gitea Actions.
