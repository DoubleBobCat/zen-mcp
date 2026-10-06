import type { TabInfo, WorkspaceDetail, ListWorkspaceTabsResult } from "../types.js";
import type { ZenWorkspace } from "../zen-globals.js";

export function listWorkspaceTabs(
  workspaceId?: string
): ListWorkspaceTabsResult {
  const id = workspaceId ?? gZenWorkspaces.activeWorkspace;
  const workspace = gZenWorkspaces.getWorkspaceFromId(id);

  if (!workspace) {
    throw new Error(`Workspace not found: ${id}`);
  }

  const tabs: TabInfo[] = [];
  let index = 0;

  for (const tab of gBrowser.tabs) {
    if (tab.hasAttribute("zen-empty-tab")) {
      continue;
    }
    if (tab.getAttribute("zen-workspace-id") !== id) {
      continue;
    }

    tabs.push({
      index: index++,
      tabId: null,
      url: tab.linkedBrowser.currentURI.spec,
      title: tab.label,
      pinned: tab.pinned,
      isActive: tab === gBrowser.selectedTab,
    });
  }

  return {
    workspace: {
      uuid: workspace.uuid,
      name: workspace.name,
      icon: workspace.icon ?? "",
    },
    tabs,
  };
}
