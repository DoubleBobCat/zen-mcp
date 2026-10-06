# Architecture Overview

zen-mcp exposes Zen Browser automation tools to external AI agents through a local bridge and a Firefox-compatible extension running inside Zen Browser. The same bridge supports WebSocket MCP and Streamable HTTP MCP at `POST /mcp`.

## Runtime Flow

```text
External MCP Client <-> WebSocket (port 9222) <-> Go Bridge <-> Firefox/Zen Extension Backend <-> Zen Browser APIs
HTTP MCP Client <-> POST /mcp <-> Go Bridge <-> Firefox/Zen Extension Backend <-> Zen Browser APIs
Debug Frontend <-> HTTP/WebSocket via Go Bridge
```

## Components

- `src/go-bridge/`: active Go bridge. It listens on port 9222 by default, accepts external WebSocket clients at `ws://localhost:9222`, Streamable HTTP MCP clients at `http://localhost:9222/mcp`, and the extension backend at `ws://localhost:9222?type=extension`. It also supports WebSocket upgrades at `/ws` and serves the standalone debug frontend from embedded static assets on the same HTTP port.
- `src/extension/background.js`: extension-side MCP request router. It exposes tool metadata, dispatches tool calls, and reconnects to the bridge server.
- `src/extension/lib/index.ts`: bundled browser automation library entry used by the extension build.
- `src/extension/lib/tools/`: TypeScript implementations for core navigation, inspection, interaction, utility, and workspace tools.
- `src/extension/experiment/`: privileged Firefox Experiment API used for Zen workspace APIs that are not available to normal extension code.
- `src/debug-frontend/`: standalone debug frontend source. It is served by the Go bridge and is not packaged into the extension XPI.
- `build/go-bridge/work/static/`: temporary copied debug frontend files embedded into the Go bridge binary and served from `http://localhost:9222/` by default.

In this phase, Go is the bridge only. The extension remains the MCP tool authority.

The HTTP adapter keeps that boundary: Go translates HTTP requests into the same extension WebSocket path and routes responses back to the originating HTTP request.

## Project Structure

```text
zen-mcp/
├── src/                    # Go bridge, debug frontend, and extension source
├── tests/                  # Cross-component consistency tests
├── docs/                   # Current implementation and required design docs
├── build/                  # Component-isolated dependencies and generated output
├── scripts/                # Repository build and release scripts
└── release/                # Release templates and installer sources
```

## Tool Groups

- Core tools: callable MCP tools registered and dispatched by `src/extension/background.js`, backed by `src/extension/lib/tools/`, the network capture manager, WebExtension APIs, and the privileged Experiment API.
- Diagnostic tools: extension diagnostics exposed for troubleshooting Experiment API registration and privileged parent APIs.
- Unfinished tools: any documented tool that does not have a callable implementation in the current runtime path.

## Generated Artifacts

- `build/artifacts/`: generated platform-independent XPI and static Linux,
  macOS, and Windows bridge packages.
- `build/go-bridge/`: generated Go bridge binaries, build workspace, and Linux
  release directory.
- `build/extension/`: Node dependencies, TypeScript output, extension staging
  files, and generated `.xpi` files.

Regenerate artifacts with `npm --prefix build/extension run build:all` instead of editing generated files by hand.
