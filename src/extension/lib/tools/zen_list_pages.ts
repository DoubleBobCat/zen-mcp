import type { ListPagesResult, PageInfo } from "../types.js";

export function listPages(): ListPagesResult {
  const pages: PageInfo[] = [];
  let activePageIndex = 0;
  
  for (let i = 0; i < gBrowser.tabs.length; i++) {
    const tab = gBrowser.tabs[i];
    if (tab.hasAttribute("zen-empty-tab")) {
      continue;
    }
    
    const isActive = tab === gBrowser.selectedTab;
    if (isActive) {
      activePageIndex = pages.length;
    }
    
    pages.push({
      index: pages.length,
      url: tab.linkedBrowser.currentURI.spec,
      title: tab.label,
      isActive: isActive,
    });
  }
  
  return {
    pages: pages,
    activePageIndex: activePageIndex,
  };
}
