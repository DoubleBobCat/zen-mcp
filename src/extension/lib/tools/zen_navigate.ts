import type { NavigateResult } from "../types.js";

export function navigate(url: string): NavigateResult {
  if (!url || url.trim() === "") {
    throw new Error("URL cannot be empty");
  }
  
  // Basic URL validation
  try {
    new URL(url);
  } catch {
    throw new Error(`Invalid URL: ${url}`);
  }
  
  gBrowser.loadURI(url);
  
  return {
    success: true,
    url: url,
  };
}
