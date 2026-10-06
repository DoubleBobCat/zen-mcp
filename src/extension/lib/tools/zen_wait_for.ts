import type { WaitForResult } from "../types.js";

export async function waitFor(
  options: { selector?: string; text?: string; timeout?: number }
): Promise<WaitForResult> {
  const { selector, text, timeout = 5000 } = options;
  
  if (!selector && !text) {
    throw new Error("Either selector or text must be provided");
  }
  
  if (timeout < 0 || timeout > 30000) {
    throw new Error("Timeout must be between 0 and 30000 milliseconds");
  }
  
  const startTime = Date.now();
  
  while (Date.now() - startTime < timeout) {
    const doc = gBrowser.getContentDocument();
    if (!doc) {
      await new Promise(resolve => setTimeout(resolve, 100));
      continue;
    }
    
    if (selector) {
      const element = gBrowser.getElementBySelector(selector);
      if (element) {
        return {
          success: true,
          found: true,
          selector: selector,
        };
      }
    }
    
    if (text) {
      const bodyText = doc.body?.textContent || "";
      if (bodyText.includes(text)) {
        return {
          success: true,
          found: true,
          text: text,
        };
      }
    }
    
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  
  return {
    success: true,
    found: false,
    selector: selector,
    text: text,
  };
}
