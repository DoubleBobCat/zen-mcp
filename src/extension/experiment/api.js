"use strict";

function getBrowserWindow() {
  const win = Services.wm.getMostRecentWindow("navigator:browser");
  if (!win) {
    throw new Error("No Zen Browser window is available");
  }
  if (!win.gZenWorkspaces || !win.gBrowser) {
    throw new Error("Zen workspace APIs are not available in this window");
  }
  return win;
}

function workspaceDetail(workspace) {
  return {
    uuid: workspace.uuid,
    name: workspace.name,
    icon: workspace.icon ?? "",
  };
}

function getWorkspaceTabs(win, workspaceId) {
  const tabs = [];
  const storedTabs = win.gZenWorkspaces.allStoredTabs || win.gBrowser.tabs;
  for (const tab of storedTabs) {
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

function requireZenFolders(win) {
  if (!win.gZenFolders) {
    throw new Error("Zen folder APIs are not available in this window");
  }
  return win.gZenFolders;
}

function requireWorkspace(win, workspaceId) {
  const id = workspaceId ?? win.gZenWorkspaces.activeWorkspace;
  const workspace = win.gZenWorkspaces.getWorkspaceFromId(id);
  if (!workspace) {
    throw new Error(`Workspace not found: ${id}`);
  }
  return { id, workspace };
}

function tabDetail(win, tab, index) {
  return {
    index,
    // Firefox exposes the content browser's browsingContext id to chrome code.
    // It is the only stable tab identity available from this privileged layer.
    tabId: tab.linkedBrowser?.browsingContext?.browserId ?? null,
    url: tab.linkedBrowser?.currentURI?.spec ?? "",
    title: tab.label ?? "",
    pinned: Boolean(tab.pinned),
    isActive: tab === win.gBrowser.selectedTab,
  };
}

function getTabById(win, tabId) {
  const tab = Array.from(win.gBrowser.tabs).find(
    (candidate) => String(candidate.linkedBrowser?.browsingContext?.browserId) === String(tabId)
  );
  if (!tab || tab.hasAttribute("zen-empty-tab")) {
    throw new Error(`Tab not found: ${tabId}`);
  }
  return tab;
}

function getRealFolderTabs(folder) {
  return Array.from(folder.tabs || []).filter((tab) => !tab.hasAttribute("zen-empty-tab"));
}

function folderTitle(folder) {
  return folder.name || folder.label || folder.getAttribute("label") || "Folder";
}

function folderDetail(win, folder, index) {
  const parent = folder.group?.isZenFolder ? folder.group : null;
  return {
    id: String(folder.id || folder.getAttribute("id") || ""),
    title: folderTitle(folder),
    index,
    workspaceId: folder.getAttribute("zen-workspace-id") ?? "",
    collapsed: Boolean(folder.collapsed),
    isLiveFolder: Boolean(folder.isLiveFolder),
    parentId: parent ? String(parent.id || parent.getAttribute("id") || "") : null,
    level: Number(folder.level || 0),
    tabs: getRealFolderTabs(folder).map((tab, tabIndex) => tabDetail(win, tab, tabIndex)),
  };
}

function getFoldersForWorkspace(win, workspaceId) {
  requireZenFolders(win);
  const folders = Array.from(win.gBrowser.tabContainer.querySelectorAll("zen-folder"));
  return folders.filter(
    (folder) => folder.getAttribute("zen-workspace-id") === workspaceId
  );
}

function getFolderById(win, workspaceId, folderId) {
  if (!folderId) {
    throw new Error("folderId is required");
  }
  const folder = getFoldersForWorkspace(win, workspaceId).find(
    (item) => String(item.id || item.getAttribute("id") || "") === folderId
  );
  if (!folder) {
    throw new Error(`Folder not found: ${folderId}`);
  }
  return folder;
}

function isTopPinnedTab(tab) {
  return (
    Boolean(tab?.pinned) &&
    !tab.hasAttribute("zen-essential") &&
    !tab.hasAttribute("zen-empty-tab") &&
    !tab.group?.isZenFolder &&
    !tab.group?.hasAttribute?.("split-view-group")
  );
}

function workspaceElement(win, workspaceId) {
  return win.gZenWorkspaces.workspaceElement?.(workspaceId) ?? null;
}

function pinnedTabsContainerForWorkspace(win, workspaceId) {
  if (workspaceId === win.gZenWorkspaces.activeWorkspace) {
    return win.gZenWorkspaces.pinnedTabsContainer;
  }
  return workspaceElement(win, workspaceId)?.pinnedTabsContainer ?? null;
}

function getTopPinnedTabs(win, workspaceId) {
  const container = pinnedTabsContainerForWorkspace(win, workspaceId);
  if (container) {
    return Array.from(container.children).filter(
      (child) => win.gBrowser.isTab?.(child) && isTopPinnedTab(child)
    );
  }
  return getWorkspaceTabs(win, workspaceId).filter(isTopPinnedTab);
}

function assertTabCanMove(tab) {
  if (tab.hasAttribute("zen-essential")) {
    throw new Error("Cannot move essential tabs");
  }
  if (tab.hasAttribute("zen-empty-tab")) {
    throw new Error("Cannot move Zen folder placeholder tabs");
  }
}

function parentDiagnosticValue(fn) {
  try {
    return { ok: true, value: fn() };
  } catch (error) {
    return { ok: false, error: String(error), stack: error?.stack ?? "" };
  }
}

function tempFileName() {
  const id = typeof globalThis.crypto?.randomUUID === "function"
    ? globalThis.crypto.randomUUID()
    : Services.uuid.generateUUID().toString().replace(/[{}]/g, "");
  return `zen-mcp-${id}.tmp`;
}

function temporaryFileApis() {
  if (typeof IOUtils !== "undefined" && typeof PathUtils !== "undefined") {
    return { IOUtils, PathUtils };
  }
  if (typeof ChromeUtils === "undefined" || typeof ChromeUtils.importESModule !== "function") {
    throw new Error("Firefox temporary file APIs are unavailable");
  }
  const io = ChromeUtils.importESModule("resource://gre/modules/IOUtils.sys.mjs");
  const paths = ChromeUtils.importESModule("resource://gre/modules/PathUtils.sys.mjs");
  if (!io.IOUtils || !paths.PathUtils) {
    throw new Error("Firefox temporary file APIs are unavailable");
  }
  return { IOUtils: io.IOUtils, PathUtils: paths.PathUtils };
}

async function roundTripTempBase64(value) {
  const { IOUtils: fileIO, PathUtils: filePaths } = temporaryFileApis();
  if (typeof value !== "string") throw new Error("Temporary file value must be base64 text");
  let bytes;
  try {
    const binary = atob(value);
    bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
  } catch {
    throw new Error("Temporary file value is not valid base64");
  }

  const path = filePaths.join(filePaths.tempDir, tempFileName());
  try {
    await fileIO.write(path, bytes);
    const result = await fileIO.read(path);
    let binary = "";
    for (let index = 0; index < result.length; index += 0x8000) {
      binary += String.fromCharCode(...result.subarray(index, Math.min(index + 0x8000, result.length)));
    }
    return btoa(binary);
  } finally {
    try {
      await fileIO.remove(path, { ignoreAbsent: true });
    } catch {
      // The temporary path is random and never returned to the extension.
    }
  }
}

this.zenMcp = class extends ExtensionAPI {
  getAPI() {
    return {
      zenMcp: {
        async listWorkspaces() {
          const win = getBrowserWindow();
          const workspaces = Array.from(win.gZenWorkspaces.getWorkspaces() || []);
          const activeId = win.gZenWorkspaces.activeWorkspace;

          return {
            workspaces: workspaces.map((workspace) => ({
              ...workspaceDetail(workspace),
              isActive: workspace.uuid === activeId,
              containerTabId: workspace.containerTabId,
            })),
            activeWorkspace: activeId,
          };
        },

        async diagnoseParent() {
          const win = Services.wm.getMostRecentWindow("navigator:browser");
          const gZenWorkspaces = win?.gZenWorkspaces;

          return {
            hasWindow: Boolean(win),
            hasGBrowser: Boolean(win?.gBrowser),
            hasGZenWorkspaces: Boolean(gZenWorkspaces),
            activeWorkspace: gZenWorkspaces?.activeWorkspace ?? null,
            gZenWorkspacesKeys: gZenWorkspaces ? Object.keys(gZenWorkspaces).sort() : [],
            hasGetWorkspaces: typeof gZenWorkspaces?.getWorkspaces === "function",
            hasGetWorkspaceFromId: typeof gZenWorkspaces?.getWorkspaceFromId === "function",
            hasMoveTabsToWorkspace: typeof gZenWorkspaces?.moveTabsToWorkspace === "function",
            hasMoveTabToWorkspace: typeof gZenWorkspaces?.moveTabToWorkspace === "function",
            hasIOUtils: typeof IOUtils !== "undefined",
            hasPathUtils: typeof PathUtils !== "undefined",
            hasImportESModule: typeof ChromeUtils !== "undefined" && typeof ChromeUtils.importESModule === "function",
            listWorkspacesResult: parentDiagnosticValue(() => {
              const workspaces = Array.from(gZenWorkspaces.getWorkspaces() || []);
              return {
                count: workspaces.length,
                firstWorkspace: workspaces[0]
                  ? {
                      uuid: workspaces[0].uuid,
                      name: workspaces[0].name,
                      icon: workspaces[0].icon ?? "",
                    }
                  : null,
              };
            }),
          };
        },

        async diagnosePing() {
          const servicesAvailable = typeof Services !== "undefined";
          return {
            ok: true,
            servicesType: servicesAvailable ? "object" : "undefined",
            hasWindowMediator: servicesAvailable ? Boolean(Services.wm) : false,
          };
        },

        async roundTripTempBase64(value) {
          return roundTripTempBase64(value);
        },

        async listWorkspaceTabs(workspaceId) {
          const win = getBrowserWindow();
          const id = workspaceId ?? win.gZenWorkspaces.activeWorkspace;
          const workspace = win.gZenWorkspaces.getWorkspaceFromId(id);
          if (!workspace) {
            throw new Error(`Workspace not found: ${id}`);
          }

          let index = 0;
          const tabs = getWorkspaceTabs(win, id).map((tab) =>
            tabDetail(win, tab, index++)
          );

          return { workspace: workspaceDetail(workspace), tabs };
        },

        async validateTabWorkspace(tabId, workspaceId) {
          const win = getBrowserWindow();
          const tab = getTabById(win, tabId);
          const actualWorkspaceId = tab.getAttribute("zen-workspace-id");
          if (actualWorkspaceId !== workspaceId) {
            throw new Error(
              `Tab ${tabId} belongs to workspace ${actualWorkspaceId || "unknown"}, expected ${workspaceId}`
            );
          }
          return { success: true, tabId, workspaceId };
        },

        async listFolders(workspaceId) {
          const win = getBrowserWindow();
          const { id, workspace } = requireWorkspace(win, workspaceId);
          const folders = getFoldersForWorkspace(win, id).map((folder, index) =>
            folderDetail(win, folder, index)
          );

          return { workspace: workspaceDetail(workspace), folders };
        },

        async manageFolder(action, workspaceId, folderId, title, tabIndices) {
          const win = getBrowserWindow();
          const zenFolders = requireZenFolders(win);
          const { id } = requireWorkspace(win, workspaceId);

          switch (action) {
            case "create": {
              if (!title || title.trim() === "") {
                throw new Error("Folder title cannot be empty");
              }
              const workspaceTabs = getWorkspaceTabs(win, id);
              const selectedTabs = Array.from(tabIndices || []).map((tabIndex) => {
                if (tabIndex < 0 || tabIndex >= workspaceTabs.length) {
                  throw new Error(
                    `tabIndex ${tabIndex} out of bounds (workspace has ${workspaceTabs.length} tabs)`
                  );
                }
                const tab = workspaceTabs[tabIndex];
                assertTabCanMove(tab);
                return tab;
              });
              const folder = zenFolders.createFolder(selectedTabs, {
                label: title.trim(),
                workspaceId: id,
                collapsed: false,
              });
              return folderDetail(win, folder, getFoldersForWorkspace(win, id).indexOf(folder));
            }

            case "rename": {
              if (!title || title.trim() === "") {
                throw new Error("Folder title cannot be empty");
              }
              const folder = getFolderById(win, id, folderId);
              folder.name = title.trim();
              folder.label = title.trim();
              if (typeof win.CustomEvent === "function") {
                folder.dispatchEvent?.(new win.CustomEvent("ZenFolderRenamed", { bubbles: true }));
              }
              return folderDetail(win, folder, getFoldersForWorkspace(win, id).indexOf(folder));
            }

            case "delete": {
              const folder = getFolderById(win, id, folderId);
              await folder.delete();
              return { success: true };
            }

            case "unpack": {
              const folder = getFolderById(win, id, folderId);
              await folder.unpackTabs();
              return { success: true };
            }

            default:
              throw new Error(`Invalid action: ${action}`);
          }
        },

        async moveTabToFolder(tabIndex, folderId, workspaceId) {
          const win = getBrowserWindow();
          const { id } = requireWorkspace(win, workspaceId);
          const workspaceTabs = getWorkspaceTabs(win, id);
          if (tabIndex < 0 || tabIndex >= workspaceTabs.length) {
            throw new Error(
              `tabIndex ${tabIndex} out of bounds (workspace has ${workspaceTabs.length} tabs)`
            );
          }
          const tab = workspaceTabs[tabIndex];
          assertTabCanMove(tab);
          const folder = getFolderById(win, id, folderId);
          if (folder.isLiveFolder) {
            throw new Error("Cannot move tabs into live folders");
          }
          folder.addTabs([tab]);
          return {
            success: true,
            folder: folderDetail(win, folder, getFoldersForWorkspace(win, id).indexOf(folder)),
          };
        },

        async moveTabOutOfFolder(folderId, tabIndex, workspaceId) {
          const win = getBrowserWindow();
          const { id } = requireWorkspace(win, workspaceId);
          const folder = getFolderById(win, id, folderId);
          const tabs = getRealFolderTabs(folder);
          if (tabIndex < 0 || tabIndex >= tabs.length) {
            throw new Error(
              `tabIndex ${tabIndex} out of bounds (folder has ${tabs.length} tabs)`
            );
          }
          const tab = tabs[tabIndex];
          assertTabCanMove(tab);
          win.gBrowser.ungroupTab(tab);
          return { success: true, tab: tabDetail(win, tab, tabIndex) };
        },

        async listTopPinnedTabs(workspaceId) {
          const win = getBrowserWindow();
          const { id, workspace } = requireWorkspace(win, workspaceId);
          const tabs = getTopPinnedTabs(win, id).map((tab, index) => tabDetail(win, tab, index));
          return { workspace: workspaceDetail(workspace), tabs };
        },

        async manageTopPinnedTab(action, tabIndex, newIndex, workspaceId) {
          const win = getBrowserWindow();
          const { id } = requireWorkspace(win, workspaceId);

          switch (action) {
            case "pin": {
              const workspaceTabs = getWorkspaceTabs(win, id);
              if (tabIndex < 0 || tabIndex >= workspaceTabs.length) {
                throw new Error(
                  `tabIndex ${tabIndex} out of bounds (workspace has ${workspaceTabs.length} tabs)`
                );
              }
              const tab = workspaceTabs[tabIndex];
              assertTabCanMove(tab);
              if (tab.group?.isZenFolder) {
                throw new Error("Cannot top-pin a tab while it is inside a Zen folder");
              }
              win.gBrowser.pinTab(tab);
              tab.setAttribute("zen-workspace-id", id);
              win.gZenWorkspaces.moveTabToWorkspace?.(tab, id);
              const topPinnedIndex = getTopPinnedTabs(win, id).indexOf(tab);
              return { success: true, tabIndex: topPinnedIndex };
            }

            case "unpin": {
              const pinnedTabs = getTopPinnedTabs(win, id);
              if (tabIndex < 0 || tabIndex >= pinnedTabs.length) {
                throw new Error(
                  `tabIndex ${tabIndex} out of bounds (top pinned list has ${pinnedTabs.length} tabs)`
                );
              }
              const tab = pinnedTabs[tabIndex];
              win.gBrowser.unpinTab(tab);
              tab.setAttribute("zen-workspace-id", id);
              return { success: true, tabIndex };
            }

            case "move": {
              const pinnedTabs = getTopPinnedTabs(win, id);
              if (tabIndex < 0 || tabIndex >= pinnedTabs.length) {
                throw new Error(
                  `tabIndex ${tabIndex} out of bounds (top pinned list has ${pinnedTabs.length} tabs)`
                );
              }
              if (newIndex === undefined || newIndex < 0 || newIndex >= pinnedTabs.length) {
                throw new Error(
                  `newIndex ${newIndex} out of bounds (top pinned list has ${pinnedTabs.length} tabs)`
                );
              }
              const tab = pinnedTabs[tabIndex];
              const target = pinnedTabs[newIndex];
              const targetElementIndex = Array.from(target.parentNode.children).indexOf(target);
              if (targetElementIndex === -1) {
                throw new Error("Target tab not found in pinned tab container");
              }
              const globalTargetIndex = win.gBrowser.tabs.indexOf(target);
              if (globalTargetIndex === -1) {
                throw new Error("Target tab not found in global tab list");
              }
              win.gBrowser.moveTabTo(tab, {
                tabIndex: globalTargetIndex,
                elementIndex: targetElementIndex,
                forceUngrouped: true,
              });
              return { success: true, tabIndex: newIndex };
            }

            default:
              throw new Error(`Invalid action: ${action}`);
          }
        },

        async moveTabInWorkspace(tabIndex, newIndex, workspaceId) {
          const win = getBrowserWindow();
          const id = workspaceId ?? win.gZenWorkspaces.activeWorkspace;
          const workspaceTabs = getWorkspaceTabs(win, id);

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
          const globalTargetIndex = win.gBrowser.tabs.indexOf(targetTab);
          if (globalTargetIndex === -1) {
            throw new Error("Target tab not found in global tab list");
          }

          win.gBrowser.moveTabTo(tab, { tabIndex: globalTargetIndex });
          return { success: true, tabIndex: newIndex };
        },

        async moveTabToWorkspace(tabIndex, targetWorkspaceId, sourceWorkspaceId) {
          const win = getBrowserWindow();
          const sourceId = sourceWorkspaceId ?? win.gZenWorkspaces.activeWorkspace;
          const sourceTabs = getWorkspaceTabs(win, sourceId);

          if (tabIndex < 0 || tabIndex >= sourceTabs.length) {
            throw new Error(
              `tabIndex ${tabIndex} out of bounds (workspace has ${sourceTabs.length} tabs)`
            );
          }

          const tab = sourceTabs[tabIndex];
          if (tab.hasAttribute("zen-essential")) {
            throw new Error("Cannot move essential tabs between workspaces");
          }

          const targetWorkspace = win.gZenWorkspaces.getWorkspaceFromId(targetWorkspaceId);
          if (!targetWorkspace) {
            throw new Error(`Target workspace not found: ${targetWorkspaceId}`);
          }

          win.gZenWorkspaces.moveTabToWorkspace(tab, targetWorkspaceId);
          return {
            success: true,
            targetWorkspace: workspaceDetail(targetWorkspace),
          };
        },

        async manageWorkspace(action, workspaceId, name) {
          const win = getBrowserWindow();

          switch (action) {
            case "create": {
              if (!name || name.trim() === "") {
                throw new Error("Workspace name cannot be empty");
              }
              const workspace = await win.gZenWorkspaces.createAndSaveWorkspace(
                name.trim(),
                undefined,
                false,
                0
              );
              return workspaceDetail(workspace);
            }

            case "delete": {
              if (!workspaceId) {
                throw new Error("workspaceId is required for delete action");
              }
              const workspaces = win.gZenWorkspaces.getWorkspaces();
              if (workspaces.length <= 1) {
                throw new Error("Cannot delete the last workspace");
              }
              const target = win.gZenWorkspaces.getWorkspaceFromId(workspaceId);
              if (!target) {
                throw new Error(`Workspace not found: ${workspaceId}`);
              }
              await win.gZenWorkspaces.removeWorkspace(workspaceId);
              return { success: true };
            }

            case "rename": {
              if (!workspaceId) {
                throw new Error("workspaceId is required for rename action");
              }
              if (!name || name.trim() === "") {
                throw new Error("Workspace name cannot be empty");
              }
              const workspace = win.gZenWorkspaces.getWorkspaceFromId(workspaceId);
              if (!workspace) {
                throw new Error(`Workspace not found: ${workspaceId}`);
              }
              workspace.name = name.trim();
              win.gZenWorkspaces.saveWorkspace(workspace);
              return {
                uuid: workspace.uuid,
                name: workspace.name,
              };
            }

            default:
              throw new Error(`Invalid action: ${action}`);
          }
        },
      },
    };
  }
};
