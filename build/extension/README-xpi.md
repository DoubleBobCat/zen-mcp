# zen-mcp XPI Installation

[English](README-xpi.md) | [简体中文](README-xpi_zh.md)

`zen-mcp-<version>.xpi` is the Zen Browser extension package.

## Install in Zen Browser

1. Open the Zen Browser extension manager at `about:addons`.
2. Use the gear menu to select “Install Add-on From File” and choose the `.xpi` file in this directory.
3. If Zen Browser rejects a local or unsigned XPI, open `about:config` and set the following preference to `true`:

   ```text
   extensions.experiments.enabled = true
   ```

4. For development, unsigned, or temporary XPIs, signature validation may also require the following preference to be `false`:

   ```text
   xpinstall.signatures.required = false
   ```

   Use this only in a local development environment that permits unsigned extensions. Restart Zen Browser after changing it, then repeat the installation steps.

5. Open the extension settings and confirm that the bridge URL is:

   ```text
   ws://localhost:9222?type=extension
   ```

## Connect to the bridge

Start the bridge, then open `http://localhost:9222/`. If the extension cannot connect, check:

- The bridge service is running: `systemctl --user status zen-mcp-bridge.service`.
- The bridge URL is `ws://localhost:9222?type=extension`.
- `extensions.experiments.enabled` is enabled.

`xpinstall.signatures.required=false` weakens extension signature validation and should only be used for local development or testing.
