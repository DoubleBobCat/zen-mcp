import type { ManageWorkspaceResult } from "../types.js";
import type { ZenWorkspace } from "../zen-globals.js";

export async function manageWorkspace(
  action: "create" | "delete" | "rename",
  workspaceId?: string,
  name?: string
): Promise<ManageWorkspaceResult> {
  switch (action) {
    case "create": {
      if (!name || name.trim() === "") {
        throw new Error("Workspace name cannot be empty");
      }
      const ws = await gZenWorkspaces.createAndSaveWorkspace(
        name.trim(),
        undefined,
        false,
        0
      );
      return {
        uuid: ws.uuid,
        name: ws.name,
        icon: ws.icon ?? "",
      };
    }

    case "delete": {
      if (!workspaceId) {
        throw new Error("workspaceId is required for delete action");
      }
      const workspaces = gZenWorkspaces.getWorkspaces();
      if (workspaces.length <= 1) {
        throw new Error("Cannot delete the last workspace");
      }
      const target = gZenWorkspaces.getWorkspaceFromId(workspaceId);
      if (!target) {
        throw new Error(`Workspace not found: ${workspaceId}`);
      }
      await gZenWorkspaces.removeWorkspace(workspaceId);
      return { success: true };
    }

    case "rename": {
      if (!workspaceId) {
        throw new Error("workspaceId is required for rename action");
      }
      if (!name || name.trim() === "") {
        throw new Error("Workspace name cannot be empty");
      }
      const ws = gZenWorkspaces.getWorkspaceFromId(workspaceId);
      if (!ws) {
        throw new Error(`Workspace not found: ${workspaceId}`);
      }
      ws.name = name.trim();
      gZenWorkspaces.saveWorkspace(ws);
      return {
        uuid: ws.uuid,
        name: ws.name,
      };
    }

    default:
      throw new Error(`Invalid action: ${action}`);
  }
}
