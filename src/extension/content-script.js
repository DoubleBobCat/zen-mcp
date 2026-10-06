"use strict";

function runPageTool(toolName, args = {}) {
  const requireSelector = (selector) => {
    if (!selector || selector.trim() === "") throw new Error("Selector cannot be empty");
    const element = document.querySelector(selector);
    if (!element) throw new Error(`Element not found: ${selector}`);
    return element;
  };
  const visibleText = () => document.body?.innerText?.substring(0, 10000) ?? "";
  const setNativeValue = (element, value) => {
    element.value = value;
    element.dispatchEvent(new Event("input", { bubbles: true }));
    element.dispatchEvent(new Event("change", { bubbles: true }));
  };

  switch (toolName) {
    case "snapshot": {
      const filter = args.filter || "all";
      const isInteractive = (el) => ["a", "button", "input", "select", "textarea"].includes(el.tagName.toLowerCase()) || el.hasAttribute("onclick") || el.hasAttribute("tabindex");
      const isForm = (el) => ["input", "select", "textarea", "button"].includes(el.tagName.toLowerCase());
      const snapshot = Array.from(document.querySelectorAll("*")).slice(0, 150).filter((el) => filter === "all" || (filter === "interactive" && isInteractive(el)) || (filter === "form" && isForm(el))).map((el) => {
        const selector = el.id ? `#${CSS.escape(el.id)}` : el.tagName.toLowerCase();
        return `<${el.tagName.toLowerCase()} selector="${selector}">${(el.textContent || "").trim().substring(0, 50)}</${el.tagName.toLowerCase()}>`;
      }).join("\n") || "No elements found";
      return { snapshot, url: location.href, title: document.title };
    }
    case "get_page_text":
      return { url: location.href, title: document.title, text: visibleText() };
    case "get_form_fields":
      return { url: location.href, title: document.title, fields: Array.from(document.querySelectorAll("input, select, textarea")).map((el) => ({
        name: el.getAttribute("name") || "",
        type: el.getAttribute("type") || el.tagName.toLowerCase(),
        label: el.labels?.[0]?.textContent?.trim() || el.getAttribute("placeholder") || el.getAttribute("aria-label") || "",
        value: el.value || "",
        selector: el.id ? `#${CSS.escape(el.id)}` : el.tagName.toLowerCase(),
        options: el.tagName.toLowerCase() === "select" ? Array.from(el.options).map((option) => option.text || option.value) : undefined,
      })) };
    case "click":
      requireSelector(args.selector).click();
      return { success: true, selector: args.selector };
    case "fill": {
      const element = requireSelector(args.selector);
      if (!["input", "textarea"].includes(element.tagName.toLowerCase())) throw new Error(`Element is not an input or textarea: ${element.tagName.toLowerCase()}`);
      setNativeValue(element, args.value ?? "");
      return { success: true, selector: args.selector, value: args.value ?? "" };
    }
    case "select_option": {
      const element = requireSelector(args.selector);
      if (element.tagName.toLowerCase() !== "select") throw new Error("Element is not a select");
      const option = Array.from(element.options).find((item) => args.by === "text" ? item.text === args.value : item.value === args.value);
      if (!option) throw new Error(`Option not found: ${args.value}`);
      element.value = option.value;
      element.dispatchEvent(new Event("change", { bubbles: true }));
      return { success: true, selector: args.selector, value: option.value };
    }
    case "check": {
      const element = requireSelector(args.selector);
      if (!["checkbox", "radio"].includes(element.type)) throw new Error(`Element is not a checkbox or radio: ${element.type}`);
      element.checked = Boolean(args.checked);
      element.dispatchEvent(new Event("change", { bubbles: true }));
      return { success: true, selector: args.selector, checked: element.checked };
    }
    case "press_key":
      document.activeElement?.dispatchEvent(new KeyboardEvent("keydown", { key: args.key, bubbles: true }));
      document.activeElement?.dispatchEvent(new KeyboardEvent("keyup", { key: args.key, bubbles: true }));
      return { success: true, key: args.key };
    case "fill_form":
      for (const field of args.fields || []) {
        if (field.action === "fill") runPageTool("fill", field);
        else if (field.action === "select") runPageTool("select_option", { ...field, by: field.by || "value" });
        else if (field.action === "check") runPageTool("check", { ...field, checked: true });
        else if (field.action === "uncheck") runPageTool("check", { ...field, checked: false });
        else if (field.action === "click") runPageTool("click", field);
        else throw new Error(`Unknown action: ${field.action}`);
      }
      return { success: true, fields: args.fields || [] };
    case "scroll": {
      const target = args.selector ? requireSelector(args.selector) : window;
      const amount = args.amount ?? 100;
      const delta = { up: [0, -amount], down: [0, amount], left: [-amount, 0], right: [amount, 0] }[args.direction || "down"];
      if (!delta) throw new Error(`Invalid scroll direction: ${args.direction}`);
      if (target === window) window.scrollBy(delta[0], delta[1]);
      else target.scrollBy(delta[0], delta[1]);
      return { success: true, selector: args.selector ?? null, direction: args.direction || "down" };
    }
    case "evaluate":
      return { result: Function(`"use strict"; return (${args.script});`)(), success: true };
    case "wait_for":
      if (args.selector && document.querySelector(args.selector)) return { success: true, found: true, selector: args.selector };
      if (args.text && document.body?.innerText?.includes(args.text)) return { success: true, found: true, text: args.text };
      throw new Error("Element or text not found");
    default:
      throw new Error(`Unsupported page tool: ${toolName}`);
  }
}

browser.runtime.onMessage.addListener((message) => {
  if (message?.type !== "zen-mcp-page-tool") return undefined;
  return Promise.resolve().then(() => runPageTool(message.toolName, message.args));
});
