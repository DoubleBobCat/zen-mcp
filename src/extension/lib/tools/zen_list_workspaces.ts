import type { WorkspaceInfo, ListWorkspacesResult } from "../types.js";
import type { ZenWorkspace } from "../zen-globals.js";

export function listWorkspaces(): ListWorkspacesResult {
  const workspaces = gZenWorkspaces.getWorkspaces();
  const active = gZenWorkspaces.getActiveWorkspace();

  const mapped: WorkspaceInfo[] = workspaces.map((ws) => ({
    uuid: ws.uuid,
    name: ws.name,
    icon: ws.icon ?? "",
    isActive: ws.uuid === active.uuid,
    containerTabId: ws.containerTabId,
  }));

  return {
    workspaces: mapped,
    activeWorkspace: active.uuid,
  };
}
