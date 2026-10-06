import type { ScrollResult } from "../types.js";

export function scroll(direction: "up" | "down" | "left" | "right", amount?: number, selector?: string): ScrollResult {
  const scrollAmount = amount || 100;
  
  if (selector) {
    // Scroll specific element into view
    gBrowser.scrollToElement(selector);
  } else {
    // Scroll the page
    let x = 0;
    let y = 0;
    
    switch (direction) {
      case "up":
        y = -scrollAmount;
        break;
      case "down":
        y = scrollAmount;
        break;
      case "left":
        x = -scrollAmount;
        break;
      case "right":
        x = scrollAmount;
        break;
    }
    
    gBrowser.scrollBy(x, y);
  }
  
  return {
    success: true,
    selector: selector,
    direction: direction,
  };
}
