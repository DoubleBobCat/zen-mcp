# zen-mcp

[English](README.md) | [简体中文](README_zh.md)

zen-mcp exposes Zen Browser automation through a local bridge and a Zen Browser extension. External MCP clients connect through WebSocket or Streamable HTTP MCP, the extension receives MCP requests, and tool implementations call Zen Browser APIs from inside the browser context.

## Capabilities

- 46 callable MCP tools: 43 core tools and 3 diagnostic tools.
- Browser automation through MCP.
- WebSocket MCP at `ws://localhost:9222` and Streamable HTTP MCP at `http://localhost:9222/mcp`.
- Navigation, inspection, interaction, network capture, and workspace management.
- Debug console at `http://localhost:9222/`.

See [docs/api/all-tools.md](docs/api/all-tools.md) for the tool reference.

## Architecture

```text
External MCP Client <-> WebSocket (port 9222) <-> Go Bridge <-> Firefox/Zen Extension Backend <-> Zen Browser APIs
HTTP MCP Client <-> POST /mcp <-> Go Bridge <-> Firefox/Zen Extension Backend <-> Zen Browser APIs
Debug Frontend <-> HTTP/WebSocket via Go Bridge
```

- `src/go-bridge/`: Go bridge for WebSocket, Streamable HTTP MCP, and the debug frontend.
- `src/extension/`: Firefox/Zen extension and browser automation library.
- `src/debug-frontend/`: browser-based bridge console.

## Install And Verify

```bash
npm --prefix build/extension install
bash scripts/install-git-hooks.sh
npm --prefix build/extension run test
npm --prefix build/extension run bridge:test
npm --prefix build/extension run typecheck
npm --prefix build/extension run build:all
```

`npm --prefix build/extension run build:all` creates one platform-independent XPI and static Go bridge packages for Linux, macOS, and Windows. See [build/go-bridge/README-zen-mcp-bridge.md](build/go-bridge/README-zen-mcp-bridge.md) and [build/extension/README-xpi.md](build/extension/README-xpi.md).

## Development Commands

```bash
npm --prefix build/extension run bridge:test
npm --prefix build/extension run bridge:build
npm --prefix build/extension run bridge
npm --prefix build/extension run server
npm --prefix build/extension run server:install
npm --prefix build/extension run build
npm --prefix build/extension run build:extension
npm --prefix build/extension run build:all
```

- `npm --prefix build/extension run bridge:test`: run Go bridge tests.
- `npm --prefix build/extension run bridge:build`: build the Go bridge and embed the standalone debug frontend assets.
- `npm --prefix build/extension run bridge:build:all`: build static Linux, macOS, and Windows bridge packages.
- `npm --prefix build/extension run bridge`: start the Go bridge with HTTP and WebSocket on port 9222 by default.
- `npm --prefix build/extension run server`: start the bridge.
- `npm --prefix build/extension run server:install`: builds the release artifacts and installs the Go bridge as a systemd user service.
- `npm --prefix build/extension run build`: compile TypeScript.
- `npm --prefix build/extension run build:extension`: build the extension into `build/extension/dist/extension/`.
- `npm --prefix build/extension run build:all`: build the Go bridge, build the extension, and package the extension into `build/extension/`.

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

## Documentation

- [文档地图](docs/README.md)
- [全部工具 API](docs/api/all-tools.md)
- [工作区工具 API](docs/api/workspace-tools.md)
- [架构概览](docs/architecture/overview.md)
- [开发流程](docs/development/workflow.md)
- [部署与运维](docs/Deployment.md)

## Build Output

- `build/artifacts/`: platform-independent XPI and static Linux, macOS, and Windows bridge packages.
- `build/go-bridge/`: Go bridge build workspace and Linux service release directory.
- `build/extension/`: Node dependencies, TypeScript output, extension staging files, and `.xpi` files.

Run `npm --prefix build/extension run build:all` after source changes. The same test, build, and release units are used by GitHub Actions and Gitea Actions.

## Debugging

1. Run `npm --prefix build/extension run build:all`.
2. Load the generated extension in Zen Browser.
3. Run `npm --prefix build/extension run bridge`.
4. Open the extension settings from the Zen Browser menu or extension popup and confirm the bridge URL is `ws://localhost:9222?type=extension`.
5. Open the standalone debug frontend served by the Go bridge at `http://localhost:9222/`.

The debug frontend connects to `ws://localhost:9222` and can send MCP requests through the same bridge path used by external clients.

Streamable HTTP MCP endpoint: `http://localhost:9222/mcp`.

## License

GPL-3.0-only. See [LICENSE](LICENSE).
