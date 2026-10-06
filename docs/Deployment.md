# Deployment - Zen MCP Browser Automation

## Deployment model

zen-mcp is a local deployment consisting of a Zen Browser extension and a Go
bridge. No hosted service, container, remote endpoint, or project-owned data
store is deployed.

```text
MCP client -> localhost:9222 Go bridge -> Zen Browser extension -> Zen Browser APIs
```

## Build and package

From the repository root:

```bash
npm --prefix build/extension install
npm --prefix build/extension run test
npm --prefix build/extension run bridge:test
npm --prefix build/extension run typecheck
npm --prefix build/extension run build:all
```

`build:all` builds the Go bridge with `CGO_ENABLED=0` for Linux, macOS, and
Windows, embeds the debug frontend, builds the platform-independent extension,
and packages the extension as `build/extension/zen-mcp-<version>.xpi`.

Generated paths include:

- `build/extension/dist/extension/`
- `build/extension/zen-mcp-<version>.xpi`
- `build/go-bridge/dist/zen-mcp-bridge`
- `build/go-bridge/release/`
- `build/artifacts/zen-mcp-bridge-linux-amd64.tar.gz`
- `build/artifacts/zen-mcp-bridge-darwin-amd64.tar.gz`
- `build/artifacts/zen-mcp-bridge-windows-amd64.zip`
- `build/artifacts/zen-mcp-<version>.xpi`

Do not edit these paths manually.

## Load and run

1. Load the generated XPI in Zen Browser.
2. Confirm the extension bridge URL is
   `ws://localhost:9222?type=extension`.
3. Start the bridge:

   ```bash
   npm --prefix build/extension run bridge
   ```

4. Verify `http://localhost:9222/`, `ws://localhost:9222`, and
   `http://localhost:9222/mcp`.

## Linux user service

After `build:all`, install the generated service with:

```bash
npm --prefix build/extension run server:install
```

The installer places the binary in `~/.local/bin/zen-mcp-bridge`, the
configuration in `${XDG_CONFIG_HOME:-~/.config}/zen-mcp/config.json`, and the
user unit in `${XDG_CONFIG_HOME:-~/.config}/systemd/user/`. It does not require
root privileges. On systems without systemd user services, run the binary
directly with `--config <path>`.

The macOS and Windows packages contain the static bridge binary and shared
configuration documentation. They are run directly; the Linux systemd user
installer is only included in the Linux release layout.

## GitHub and Gitea automation

`.github/workflows/ci.yml` and `.gitea/workflows/ci.yml` run the same test and
build units on pushes and pull requests. Tag builds use the successful CI
artifacts in the corresponding CD workflow to publish a release. GitHub uses
the repository release API; Gitea uses its compatible release API and requires
the `GITEA_TOKEN` secret.

## Configuration

Configuration precedence is built-in defaults, JSON file, then environment
variables. The bridge supports `ZEN_MCP_CONFIG`, `ZEN_MCP_PORT`,
`ZEN_MCP_HTTP_TIMEOUT`, `ZEN_MCP_SESSION_IDLE_TIMEOUT`, and
`ZEN_MCP_SWITCH_LOCK_TIMEOUT`.

Defaults are port `9222`, HTTP timeout `30s`, session idle timeout `10m`, and
switch-lock timeout `30s`.

## Rollback

Stop the bridge or systemd user service, reload a known-good XPI, and restore a
known-good source revision before rebuilding. Generated artifacts must be
regenerated through the build workflow.
