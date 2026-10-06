import type { SelectPageResult } from "../types.js";

export function selectPage(pageIndex: number): SelectPageResult {
  if (pageIndex < 0 || pageIndex >= gBrowser.tabs.length) {
    throw new Error(`pageIndex ${pageIndex} out of bounds (browser has ${gBrowser.tabs.length} tabs)`);
  }
  
  const tab = gBrowser.tabs[pageIndex];
  if (tab.hasAttribute("zen-empty-tab")) {
    throw new Error(`Cannot select empty tab at index ${pageIndex}`);
  }
  
  gBrowser.selectTab(tab);
  
  return {
    success: true,
    pageIndex: pageIndex,
  };
}
