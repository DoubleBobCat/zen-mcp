import type { NewTabResult } from "../types.js";

export function newTab(url?: string): NewTabResult {
  if (url) {
    try {
      new URL(url);
    } catch {
      throw new Error(`Invalid URL: ${url}`);
    }
  }
  
  const tab = gBrowser.addTab(url || "about:blank");
  const tabIndex = gBrowser.tabs.indexOf(tab);
  
  return {
    success: true,
    tabIndex: tabIndex,
    url: url,
  };
}
