import type { CloseTabResult } from "../types.js";

export function closeTab(tabIndex: number): CloseTabResult {
  if (tabIndex < 0 || tabIndex >= gBrowser.tabs.length) {
    throw new Error(`tabIndex ${tabIndex} out of bounds (browser has ${gBrowser.tabs.length} tabs)`);
  }
  
  // Don't close the last tab
  if (gBrowser.tabs.length <= 1) {
    throw new Error("Cannot close the last tab");
  }
  
  const tab = gBrowser.tabs[tabIndex];
  if (tab.hasAttribute("zen-empty-tab")) {
    throw new Error(`Cannot close empty tab at index ${tabIndex}`);
  }
  
  gBrowser.removeTab(tab);
  
  return {
    success: true,
    tabIndex: tabIndex,
  };
}
