import type { EvaluateResult } from "../types.js";

export function evaluate(script: string): EvaluateResult {
  if (!script || script.trim() === "") {
    throw new Error("Script cannot be empty");
  }
  
  try {
    const result = gBrowser.executeScript(script);
    return {
      result: result,
      success: true,
    };
  } catch (error) {
    throw new Error(`Script execution failed: ${error}`);
  }
}
