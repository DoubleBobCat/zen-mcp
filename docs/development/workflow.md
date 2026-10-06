# Development Workflow

## Prerequisites

- Node.js 18+
- Go 1.22+
- `zip` and `tar` for release packaging
- Zen Browser
- Firefox/Zen support for temporary extension loading

The executable npm scripts documented here are defined by
`build/extension/package.json`. Keep command names and behavior synchronized
with that file when the build workflow changes.

## Install Dependencies

```bash
npm --prefix build/extension install
```

## Verify Source

```bash
npm --prefix build/extension run test
npm --prefix build/extension run bridge:test
npm --prefix build/extension run typecheck
```

## Build And Package

```bash
npm --prefix build/extension run bridge:build
npm --prefix build/extension run bridge:build:all
npm --prefix build/extension run build:extension
npm --prefix build/extension run build
npm --prefix build/extension run build:all
```

`npm --prefix build/extension run bridge:build` builds the native Linux bridge for local development. `npm --prefix build/extension run bridge:build:all` builds static `linux/amd64`, `darwin/amd64`, and `windows/amd64` packages with `CGO_ENABLED=0`. `npm --prefix build/extension run build:extension` builds the platform-independent extension output under `build/extension/dist/extension/`. `npm --prefix build/extension run build:all` runs the cross-platform bridge build, extension build, and XPI package step.

The reusable automation units are:

- `npm --prefix build/extension run ci:test`: Node tests, Go tests, typecheck, and documentation validation.
- `npm --prefix build/extension run ci:build`: cross-platform bridge packages, extension build, and XPI packaging.
- `npm --prefix build/extension run ci:release`: validates the release artifact directory for a hosting-provider release job.

## Run Bridge Server

```bash
npm --prefix build/extension run bridge
npm --prefix build/extension run server
```

The Go bridge listens on port 9222 by default. External WebSocket clients connect to `ws://localhost:9222`, Streamable HTTP MCP clients connect to `http://localhost:9222/mcp`, the extension backend connects to `ws://localhost:9222?type=extension`, and the standalone debug frontend is served over HTTP from the same port. Configuration is loaded from `${XDG_CONFIG_HOME:-~/.config}/zen-mcp/config.json`; `--config` and `ZEN_MCP_CONFIG` can override the path. `npm run server` remains a compatibility alias for `npm run bridge`.

In this phase, Go is the bridge only. The extension remains the MCP tool authority.

## Install the Linux User Service

```bash
npm --prefix build/extension run server:install
```

This builds the current release artifacts and runs `build/go-bridge/release/install.sh` to install the Go bridge as a systemd user service. It is not a Native Messaging workflow.

## Debug Console

1. Run `npm --prefix build/extension run build:all`.
2. Load the generated extension in Zen Browser.
3. Run `npm --prefix build/extension run bridge`.
4. Open the extension settings from the Zen Browser menu or extension popup and confirm the bridge URL is `ws://localhost:9222?type=extension`.
5. Open the standalone debug frontend served by the Go bridge at `http://localhost:9222/`.

The standalone debug frontend source lives in `src/debug-frontend/`. `npm --prefix build/extension run debug:build` assembles a temporary Go build workspace under `build/go-bridge/work/`, where the Go bridge embeds the copied frontend assets.

## Generated Files

Do not edit generated files in `build/` by hand. Update source files, then regenerate outputs with `npm --prefix build/extension run build:all`.

After any source change that participates in the build, reload the generated XPI
in Zen Browser and complete the relevant manual verification before considering
the change complete.
