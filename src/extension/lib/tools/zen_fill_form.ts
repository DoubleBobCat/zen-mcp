import type { FillFormResult } from "../types.js";
import { fill } from "./zen_fill.js";
import { selectOption } from "./zen_select_option.js";
import { check } from "./zen_check.js";
import { click } from "./zen_click.js";

interface FormFieldAction {
  selector: string;
  action: "fill" | "select" | "check" | "uncheck" | "click";
  value?: string;
  by?: "value" | "text";
}

export function fillForm(fields: FormFieldAction[]): FillFormResult {
  if (!fields || fields.length === 0) {
    throw new Error("Fields array cannot be empty");
  }
  
  const results: { selector: string; value: string }[] = [];
  
  for (const field of fields) {
    switch (field.action) {
      case "fill":
        if (!field.value) {
          throw new Error(`Value is required for fill action on ${field.selector}`);
        }
        fill(field.selector, field.value);
        results.push({ selector: field.selector, value: field.value });
        break;
        
      case "select":
        if (!field.value) {
          throw new Error(`Value is required for select action on ${field.selector}`);
        }
        selectOption(field.selector, field.value, field.by || "value");
        results.push({ selector: field.selector, value: field.value });
        break;
        
      case "check":
        check(field.selector, true);
        results.push({ selector: field.selector, value: "checked" });
        break;
        
      case "uncheck":
        check(field.selector, false);
        results.push({ selector: field.selector, value: "unchecked" });
        break;
        
      case "click":
        click(field.selector);
        results.push({ selector: field.selector, value: "clicked" });
        break;
        
      default:
        throw new Error(`Unknown action: ${field.action}`);
    }
  }
  
  return {
    success: true,
    fields: results,
  };
}
