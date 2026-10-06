import type { ZenTab } from "./zen-globals.js";

export function getWorkspaceTabs(workspaceId: string): ZenTab[] {
  const tabs: ZenTab[] = [];
  for (const tab of gBrowser.tabs) {
    if (tab.hasAttribute("zen-empty-tab")) {
      continue;
    }
    if (tab.getAttribute("zen-workspace-id") !== workspaceId) {
      continue;
    }
    tabs.push(tab);
  }
  return tabs;
}
