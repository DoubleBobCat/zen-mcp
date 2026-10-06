# Test Plan - Zen MCP Browser Automation

[English](Test-Plan.md) | [简体中文](Test-Plan_zh.md)

## Automated checks

Run from the repository root:

```bash
npm --prefix build/extension run test
npm --prefix build/extension run bridge:test
npm --prefix build/extension run typecheck
npm --prefix build/extension run ci:test
bash /home/doublecat/.config/opencode/skills/documentation-first-engineering/scripts/validate-docs.sh validate .
```

The Node suite verifies tool registration, schemas, dispatch, debug frontend
contracts, network isolation, session cleanup, reconnect behavior, and project
documentation consistency. Go tests verify bridge routing, HTTP behavior,
configuration, response correlation, and embedded frontend serving.

## Build verification

When source files or build inputs change, also run:

```bash
npm --prefix build/extension run build:all
npm --prefix build/extension run ci:build
```

Confirm the XPI, Linux/macOS/Windows static bridge packages, Linux release
directory, and embedded debug frontend are generated. Load the XPI in Zen
Browser before manual verification.

## CI/CD verification

- GitHub Actions and Gitea Actions expose separate test, build, and release
  units.
- CI must complete the test unit before the build unit runs.
- CD must publish only after a successful tag CI run.
- Published assets include one XPI and three static Go bridge packages.

## Manual runtime checks

1. Start the bridge and confirm the extension connects.
2. Call `initialize`, `tools/list`, and a simple `tools/call` through WebSocket
   and `POST /mcp`.
3. Verify page tools operate on a non-active explicit `tabId`; verify screenshot
   reports the selected-tab execution mode.
4. Verify workspace, folder, and top-pinned-tab reads and mutations with
   disposable browser state.
5. Start and stop a network session, inspect a text body, test filters, and
   verify credential projection and browser-managed replay.
6. Use two sessions to verify tab cleanup and active-tab lock conflicts.
7. Start Zen Browser before the bridge and verify extension reconnect without a
   browser restart.
8. Open the debug frontend and export CSV for supported list results.

## Safety and test data

Use disposable tabs, isolated test sites, and non-production accounts. Replay
can perform real writes. Folder deletion, tab cleanup, and service installation
can mutate local state and must not target important browser work.

## Exit criteria

- Automated Node, Go, typecheck, and documentation checks pass.
- `build:all` passes for source changes.
- The generated XPI loads and the bridge starts.
- WebSocket, HTTP, debug frontend, and representative tool calls work.
