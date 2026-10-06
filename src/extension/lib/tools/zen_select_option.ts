import type { SelectOptionResult } from "../types.js";

export function selectOption(selector: string, value: string, by: "value" | "text" = "value"): SelectOptionResult {
  if (!selector || selector.trim() === "") {
    throw new Error("Selector cannot be empty");
  }
  
  const element = gBrowser.getElementBySelector(selector) as HTMLSelectElement;
  if (!element) {
    throw new Error(`Element not found: ${selector}`);
  }
  
  if (element.tagName.toLowerCase() !== "select") {
    throw new Error(`Element is not a select: ${element.tagName}`);
  }
  
  let found = false;
  for (let i = 0; i < element.options.length; i++) {
    const opt = element.options[i];
    if (by === "value" && opt.value === value) {
      element.selectedIndex = i;
      found = true;
      break;
    } else if (by === "text" && opt.text === value) {
      element.selectedIndex = i;
      found = true;
      break;
    }
  }
  
  if (!found) {
    throw new Error(`Option not found: ${value}`);
  }
  
  // Trigger change event
  const changeEvent = new Event("change", { bubbles: true });
  element.dispatchEvent(changeEvent);
  
  return {
    success: true,
    selector: selector,
    value: value,
  };
}
