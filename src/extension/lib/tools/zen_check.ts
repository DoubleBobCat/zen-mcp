import type { CheckResult } from "../types.js";

export function check(selector: string, checked: boolean): CheckResult {
  if (!selector || selector.trim() === "") {
    throw new Error("Selector cannot be empty");
  }
  
  const element = gBrowser.getElementBySelector(selector) as HTMLInputElement;
  if (!element) {
    throw new Error(`Element not found: ${selector}`);
  }
  
  const type = element.type?.toLowerCase();
  if (type !== "checkbox" && type !== "radio") {
    throw new Error(`Element is not a checkbox or radio: ${type}`);
  }
  
  element.checked = checked;
  
  // Trigger change event
  const changeEvent = new Event("change", { bubbles: true });
  element.dispatchEvent(changeEvent);
  
  return {
    success: true,
    selector: selector,
    checked: checked,
  };
}
