# Roadmap - Zen MCP Browser Automation

[English](Roadmap.md) | [简体中文](Roadmap_zh.md)

## Current release baseline

The current implementation includes:

- 43 core tools and 3 diagnostic tools.
- WebSocket and Streamable HTTP MCP transport.
- Explicit tab targeting and workspace validation.
- Workspace, folder, and top-pinned-tab operations.
- Network capture, bounded body inspection, and replay.
- Session tab cleanup and active-tab locking.
- Debug frontend CSV export for supported list results.
- Static Linux, macOS, and Windows bridge release packaging and optional Linux
  systemd user installation.
- GitHub Actions and Gitea Actions test/build CI with successful-CI release CD.

## Maintenance work

1. Keep `docs/api/all-tools.md`, `docs/api/workspace-tools.md`, OpenAPI, and
   runtime registration synchronized.
2. Run the documented automated checks after source or contract changes.
3. Rebuild and reload the XPI after source changes.
4. Verify Zen Browser internal API compatibility when folder or pinned-tab
   behavior changes upstream.

## Explicitly out of scope

- DevTools Console history access.
- Public MCP event subscriptions.
- Remote or hosted deployment.
- Multiple browser instances or multi-window routing.
- Persistent project-owned browser data.

Future feature proposals belong outside this repository's current `docs/`
directory until they are accepted and implemented.
