import type { PressKeyResult } from "../types.js";

export function pressKey(key: string): PressKeyResult {
  if (!key || key.trim() === "") {
    throw new Error("Key cannot be empty");
  }
  
  // Map common key names to key codes
  const keyMap: { [key: string]: string } = {
    "enter": "Enter",
    "tab": "Tab",
    "escape": "Escape",
    "esc": "Escape",
    "backspace": "Backspace",
    "delete": "Delete",
    "space": " ",
    "arrowup": "ArrowUp",
    "arrowdown": "ArrowDown",
    "arrowleft": "ArrowLeft",
    "arrowright": "ArrowRight",
    "home": "Home",
    "end": "End",
    "pageup": "PageUp",
    "pagedown": "PageDown",
  };
  
  const normalizedKey = key.toLowerCase();
  const mappedKey = keyMap[normalizedKey] || key;
  
  // Handle modifier combinations like Ctrl+A
  if (mappedKey.includes("+")) {
    const parts = mappedKey.split("+");
    const modifier = parts[0].toLowerCase();
    const mainKey = parts[1];
    
    const modifiers: { [key: string]: boolean } = {
      ctrl: false,
      alt: false,
      shift: false,
      meta: false,
    };
    
    if (modifier === "ctrl" || modifier === "control") {
      modifiers.ctrl = true;
    } else if (modifier === "alt") {
      modifiers.alt = true;
    } else if (modifier === "shift") {
      modifiers.shift = true;
    } else if (modifier === "meta" || modifier === "cmd") {
      modifiers.meta = true;
    }
    
    gBrowser.sendKeyEvent(mainKey, modifiers);
  } else {
    gBrowser.sendKeyEvent(mappedKey);
  }
  
  return {
    success: true,
    key: key,
  };
}
