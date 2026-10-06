import type { PageTextResult } from "../types.js";

export function getPageText(): PageTextResult {
  const doc = gBrowser.getContentDocument();
  if (!doc) {
    throw new Error("No active page content");
  }
  
  const text = extractVisibleText(doc);
  
  return {
    url: gPage.getLocation(),
    title: gPage.getTitle(),
    text: text,
  };
}

function extractVisibleText(doc: Document): string {
  // Get all text nodes, excluding script and style
  const walker = document.createTreeWalker(
    doc.body,
    NodeFilter.SHOW_TEXT,
    {
      acceptNode: function(node) {
        const parent = node.parentElement;
        if (!parent) return NodeFilter.FILTER_REJECT;
        
        const tag = parent.tagName.toLowerCase();
        if (tag === "script" || tag === "style" || tag === "noscript") {
          return NodeFilter.FILTER_REJECT;
        }
        
        // Skip hidden elements
        const style = window.getComputedStyle(parent);
        if (style.display === "none" || style.visibility === "hidden") {
          return NodeFilter.FILTER_REJECT;
        }
        
        return NodeFilter.FILTER_ACCEPT;
      }
    }
  );
  
  const textParts: string[] = [];
  let node;
  while (node = walker.nextNode()) {
    const text = node.textContent?.trim();
    if (text && text.length > 0) {
      textParts.push(text);
    }
  }
  
  return textParts.join(" ").substring(0, 10000); // Limit to 10k chars
}
