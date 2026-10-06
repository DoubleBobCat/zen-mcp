/**
 * zen-mcp Debug Bridge
 *
 * This script exposes the MCP tool functions to the debug page via window.__zen_mcp_bridge__.
 * Load this script in the extension's privileged context to enable the debug console.
 */

// ZenMCP is the global namespace from the IIFE bundle
window.__zen_mcp_bridge__ = {
  listWorkspaces: ZenMCP.listWorkspaces,
  listWorkspaceTabs: ZenMCP.listWorkspaceTabs,
  moveTabInWorkspace: ZenMCP.moveTabInWorkspace,
  moveTabToWorkspace: ZenMCP.moveTabToWorkspace,
  manageWorkspace: ZenMCP.manageWorkspace,
};

// Also expose via a global function that debug page can access
window.getZenMCPBridge = function() {
  return window.__zen_mcp_bridge__;
};
