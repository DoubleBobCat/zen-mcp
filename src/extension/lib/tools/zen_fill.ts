import type { FillResult } from "../types.js";

export function fill(selector: string, value: string): FillResult {
  if (!selector || selector.trim() === "") {
    throw new Error("Selector cannot be empty");
  }
  
  const element = gBrowser.getElementBySelector(selector) as HTMLInputElement;
  if (!element) {
    throw new Error(`Element not found: ${selector}`);
  }
  
  const tagName = element.tagName.toLowerCase();
  if (tagName !== "input" && tagName !== "textarea") {
    throw new Error(`Element is not an input or textarea: ${tagName}`);
  }
  
  // Clear existing value
  element.value = "";
  
  // Set new value
  element.value = value;
  
  // Trigger input event
  const inputEvent = new Event("input", { bubbles: true });
  element.dispatchEvent(inputEvent);
  
  // Trigger change event
  const changeEvent = new Event("change", { bubbles: true });
  element.dispatchEvent(changeEvent);
  
  return {
    success: true,
    selector: selector,
    value: value,
  };
}
