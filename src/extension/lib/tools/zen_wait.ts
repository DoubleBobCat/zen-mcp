import type { WaitResult } from "../types.js";

export async function wait(milliseconds: number): Promise<WaitResult> {
  if (milliseconds < 0) {
    throw new Error("Milliseconds cannot be negative");
  }
  
  if (milliseconds > 30000) {
    throw new Error("Maximum wait time is 30 seconds");
  }
  
  await new Promise(resolve => setTimeout(resolve, milliseconds));
  
  return {
    success: true,
    milliseconds: milliseconds,
  };
}
