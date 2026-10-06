import type { SnapshotResult } from "../types.js";

export function snapshot(filter: "all" | "interactive" | "form" = "all"): SnapshotResult {
  const doc = gBrowser.getContentDocument();
  if (!doc) {
    throw new Error("No active page content");
  }
  
  // This is a simplified snapshot implementation
  // In a real implementation, you would traverse the DOM and build a structured snapshot
  const snapshot = generateSnapshot(doc, filter);
  
  return {
    snapshot: snapshot,
    url: gPage.getLocation(),
    title: gPage.getTitle(),
  };
}

function generateSnapshot(doc: Document, filter: string): string {
  // Simplified implementation - in reality this would be more sophisticated
  const elements = doc.querySelectorAll("*");
  let result = "";
  
  for (let i = 0; i < Math.min(elements.length, 100); i++) {
    const el = elements[i];
    const tag = el.tagName.toLowerCase();
    const text = el.textContent?.trim().substring(0, 50) || "";
    const selector = generateSelector(el);
    
    if (filter === "interactive" && !isInteractiveElement(el)) {
      continue;
    }
    if (filter === "form" && !isFormElement(el)) {
      continue;
    }
    
    result += `<${tag} selector="${selector}">${text}</${tag}>\n`;
  }
  
  return result || "No elements found";
}

function generateSelector(el: Element): string {
  // Simplified selector generation
  if (el.id) {
    return `#${el.id}`;
  }
  if (el.className) {
    return `.${el.className.split(" ").join(".")}`;
  }
  return el.tagName.toLowerCase();
}

function isInteractiveElement(el: Element): boolean {
  const interactiveTags = ["a", "button", "input", "select", "textarea"];
  return interactiveTags.includes(el.tagName.toLowerCase()) || 
         el.hasAttribute("onclick") ||
         el.hasAttribute("tabindex");
}

function isFormElement(el: Element): boolean {
  const formTags = ["input", "select", "textarea", "button"];
  return formTags.includes(el.tagName.toLowerCase());
}
