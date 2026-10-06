import type { ClickResult } from "../types.js";

export function click(selector: string): ClickResult {
  if (!selector || selector.trim() === "") {
    throw new Error("Selector cannot be empty");
  }
  
  const element = gBrowser.getElementBySelector(selector);
  if (!element) {
    throw new Error(`Element not found: ${selector}`);
  }
  
  // Simulate click
  const clickEvent = new MouseEvent("click", {
    view: window,
    bubbles: true,
    cancelable: true,
  });
  element.dispatchEvent(clickEvent);
  
  return {
    success: true,
    selector: selector,
  };
}
