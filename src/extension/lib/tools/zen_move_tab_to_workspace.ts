import type { MoveTabResult, WorkspaceDetail } from "../types.js";
import type { ZenWorkspace } from "../zen-globals.js";
import { getWorkspaceTabs } from "../utils.js";

export function moveTabToWorkspace(
  tabIndex: number,
  targetWorkspaceId: string,
  sourceWorkspaceId?: string
): MoveTabResult {
  const sourceId = sourceWorkspaceId ?? gZenWorkspaces.activeWorkspace;
  const sourceTabs = getWorkspaceTabs(sourceId);

  if (tabIndex < 0 || tabIndex >= sourceTabs.length) {
    throw new Error(
      `tabIndex ${tabIndex} out of bounds (workspace has ${sourceTabs.length} tabs)`
    );
  }

  const tab = sourceTabs[tabIndex];

  if (tab.hasAttribute("zen-essential")) {
    throw new Error("Cannot move essential tabs between workspaces");
  }

  const targetWorkspace = gZenWorkspaces.getWorkspaceFromId(targetWorkspaceId);
  if (!targetWorkspace) {
    throw new Error(`Target workspace not found: ${targetWorkspaceId}`);
  }

  gZenWorkspaces.moveTabToWorkspace(tab, targetWorkspaceId);

  return {
    success: true,
    targetWorkspace: {
      uuid: targetWorkspace.uuid,
      name: targetWorkspace.name,
      icon: targetWorkspace.icon ?? "",
    },
  };
}
