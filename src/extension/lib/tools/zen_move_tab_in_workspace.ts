import type { MoveTabResult } from "../types.js";
import { getWorkspaceTabs } from "../utils.js";

export function moveTabInWorkspace(
  tabIndex: number,
  newIndex: number,
  workspaceId?: string
): MoveTabResult {
  const id = workspaceId ?? gZenWorkspaces.activeWorkspace;
  const workspaceTabs = getWorkspaceTabs(id);

  if (tabIndex < 0 || tabIndex >= workspaceTabs.length) {
    throw new Error(
      `tabIndex ${tabIndex} out of bounds (workspace has ${workspaceTabs.length} tabs)`
    );
  }

  if (newIndex < 0 || newIndex >= workspaceTabs.length) {
    throw new Error(
      `newIndex ${newIndex} out of bounds (workspace has ${workspaceTabs.length} tabs)`
    );
  }

  const tab = workspaceTabs[tabIndex];
  const targetTab = workspaceTabs[newIndex];
  
  // Find the global index of the target tab in gBrowser.tabs
  const globalTargetIndex = gBrowser.tabs.indexOf(targetTab);
  if (globalTargetIndex === -1) {
    throw new Error("Target tab not found in global tab list");
  }
  
  gBrowser.moveTabTo(tab, { tabIndex: globalTargetIndex });

  return { success: true, tabIndex: newIndex };
}
