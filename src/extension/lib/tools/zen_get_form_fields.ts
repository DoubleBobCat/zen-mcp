import type { GetFormFieldsResult, FormField } from "../types.js";

export function getFormFields(): GetFormFieldsResult {
  const doc = gBrowser.getContentDocument();
  if (!doc) {
    throw new Error("No active page content");
  }
  
  const fields = extractFormFields(doc);
  
  return {
    url: gPage.getLocation(),
    title: gPage.getTitle(),
    fields: fields,
  };
}

function extractFormFields(doc: Document): FormField[] {
  const fields: FormField[] = [];
  const formElements = doc.querySelectorAll("input, select, textarea");
  
  formElements.forEach((el, index) => {
    const tagName = el.tagName.toLowerCase();
    const name = el.getAttribute("name") || "";
    const type = el.getAttribute("type") || tagName;
    const label = findLabel(doc, el);
    const value = (el as HTMLInputElement).value || "";
    const selector = generateSelector(el, index);
    const options = tagName === "select" ? extractSelectOptions(el as HTMLSelectElement) : undefined;
    
    fields.push({
      name,
      type,
      label,
      value,
      selector,
      options,
    });
  });
  
  return fields;
}

function findLabel(doc: Document, el: Element): string {
  // Try to find label by for attribute
  const id = el.getAttribute("id");
  if (id) {
    const label = doc.querySelector(`label[for="${id}"]`);
    if (label) {
      return label.textContent?.trim() || "";
    }
  }
  
  // Try to find parent label
  let parent = el.parentElement;
  while (parent) {
    if (parent.tagName.toLowerCase() === "label") {
      return parent.textContent?.trim() || "";
    }
    parent = parent.parentElement;
  }
  
  // Use placeholder or title as fallback
  return el.getAttribute("placeholder") || 
         el.getAttribute("title") || 
         el.getAttribute("aria-label") || "";
}

function generateSelector(el: Element, index: number): string {
  if (el.id) {
    return `#${el.id}`;
  }
  const htmlEl = el as HTMLInputElement;
  if (htmlEl.name) {
    return `[name="${htmlEl.name}"]`;
  }
  // Use nth-of-type as fallback
  const tag = el.tagName.toLowerCase();
  const parent = el.parentElement;
  if (parent) {
    const siblings = Array.from(parent.children).filter(c => c.tagName.toLowerCase() === tag);
    const siblingIndex = siblings.indexOf(el);
    if (siblingIndex > 0) {
      return `${tag}:nth-of-type(${siblingIndex + 1})`;
    }
  }
  return `${tag}:nth-child(${index + 1})`;
}

function extractSelectOptions(select: HTMLSelectElement): string[] {
  const options: string[] = [];
  for (let i = 0; i < select.options.length; i++) {
    const opt = select.options[i];
    options.push(opt.text || opt.value);
  }
  return options;
}
