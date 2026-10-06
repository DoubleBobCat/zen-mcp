// WebSocket connection to bridge server
const DEFAULT_BRIDGE_SETTINGS = {
  url: "ws://localhost:9222?type=extension",
  reconnectInterval: 5000,
  autoConnect: true,
};

const DEFAULT_SWITCH_LOCK_TIMEOUT = 30000;
const sessionTabs = new Map();
const activeSessions = new Set();
let tabSwitchLock = null;
let tabSwitchLockTimer = null;

function clearTabSwitchLockTimer() {
  if (tabSwitchLockTimer) {
    clearTimeout(tabSwitchLockTimer);
    tabSwitchLockTimer = null;
  }
}

function sessionIdFor(context) {
  return context?.sessionId || "legacy-session";
}

function touchSessionTab(sessionId, tabId) {
  if (!Number.isInteger(tabId) || tabId < 0) return;
  let tabs = sessionTabs.get(sessionId);
  if (!tabs) {
    tabs = new Set();
    sessionTabs.set(sessionId, tabs);
  }
  tabs.add(tabId);
  activeSessions.add(sessionId);
}

function forgetRemovedTab(tabId) {
  globalThis.zenNetworkCapture?.removeTab?.(tabId);
  for (const [sessionId, tabs] of sessionTabs) {
    tabs.delete(tabId);
    if (tabs.size === 0) sessionTabs.delete(sessionId);
  }
}

function lockTimeoutFromContext(context) {
  const value = Number(context?.switchLockTimeout);
  return Number.isFinite(value) && value > 0 ? value : DEFAULT_SWITCH_LOCK_TIMEOUT;
}

function clearExpiredTabSwitchLock() {
  if (tabSwitchLock && tabSwitchLock.expiresAt <= Date.now()) {
    tabSwitchLock = null;
    clearTabSwitchLockTimer();
  }
}

function scheduleTabSwitchLockExpiry() {
  clearTabSwitchLockTimer();
  if (!tabSwitchLock) return;
  tabSwitchLockTimer = setTimeout(() => {
    clearExpiredTabSwitchLock();
  }, Math.max(0, tabSwitchLock.expiresAt - Date.now()));
}

function lockConflictError() {
  clearExpiredTabSwitchLock();
  const remainingMs = Math.max(0, tabSwitchLock.expiresAt - Date.now());
  const error = new Error(`TAB_SWITCH_LOCK_CONFLICT: lockOwnerSessionId=${tabSwitchLock.ownerSessionId}, expiresAt=${new Date(tabSwitchLock.expiresAt).toISOString()}, remainingMs=${remainingMs}`);
  error.code = "TAB_SWITCH_LOCK_CONFLICT";
  error.lockOwnerSessionId = tabSwitchLock.ownerSessionId;
  error.expiresAt = new Date(tabSwitchLock.expiresAt).toISOString();
  error.remainingMs = remainingMs;
  return error;
}

function acquireTabSwitchLock(sessionId, leaseMs, explicit = false) {
  clearExpiredTabSwitchLock();
  if (tabSwitchLock && tabSwitchLock.ownerSessionId !== sessionId) {
    throw lockConflictError();
  }
  const duration = Number.isFinite(Number(leaseMs)) && Number(leaseMs) > 0
    ? Number(leaseMs)
    : DEFAULT_SWITCH_LOCK_TIMEOUT;
  tabSwitchLock = {
    ownerSessionId: sessionId,
    acquiredAt: tabSwitchLock?.acquiredAt ?? Date.now(),
    expiresAt: Date.now() + duration,
    explicit: Boolean(explicit || tabSwitchLock?.explicit),
  };
  scheduleTabSwitchLockExpiry();
  return {
    success: true,
    locked: true,
    ownerSessionId: sessionId,
    expiresAt: new Date(tabSwitchLock.expiresAt).toISOString(),
    remainingMs: duration,
  };
}

function releaseTabSwitchLock(sessionId) {
  clearExpiredTabSwitchLock();
  if (!tabSwitchLock) return { success: true, released: false };
  if (tabSwitchLock.ownerSessionId !== sessionId) throw lockConflictError();
  tabSwitchLock = null;
  clearTabSwitchLockTimer();
  return { success: true, released: true };
}

function getTabSwitchLock() {
  clearExpiredTabSwitchLock();
  if (!tabSwitchLock) return { locked: false };
  return {
    locked: true,
    ownerSessionId: tabSwitchLock.ownerSessionId,
    expiresAt: new Date(tabSwitchLock.expiresAt).toISOString(),
    remainingMs: Math.max(0, tabSwitchLock.expiresAt - Date.now()),
  };
}

async function withTabSwitchLock(sessionId, context, operation) {
  clearExpiredTabSwitchLock();
  const alreadyHeld = tabSwitchLock?.ownerSessionId === sessionId && tabSwitchLock.explicit;
  if (!alreadyHeld) acquireTabSwitchLock(sessionId, lockTimeoutFromContext(context), false);
  try {
    return await operation();
  } finally {
    if (!alreadyHeld && tabSwitchLock?.ownerSessionId === sessionId && !tabSwitchLock.explicit) {
      tabSwitchLock = null;
      clearTabSwitchLockTimer();
    }
  }
}

async function cleanupSession(sessionId) {
  globalThis.zenNetworkCapture?.cleanupOwner?.(sessionId);
  activeSessions.delete(sessionId);
  const ownedTabs = sessionTabs.get(sessionId);
  sessionTabs.delete(sessionId);
  if (tabSwitchLock?.ownerSessionId === sessionId) {
    tabSwitchLock = null;
    clearTabSwitchLockTimer();
  }
  if (!ownedTabs || ownedTabs.size === 0) return { success: true, closedTabIds: [] };

  const sharedTabs = new Set();
  for (const tabs of sessionTabs.values()) {
    for (const tabId of tabs) sharedTabs.add(tabId);
  }
  const tabs = await browser.tabs.query({});
  const closable = [...ownedTabs].filter((tabId) => !sharedTabs.has(tabId) && tabs.some((tab) => tab.id === tabId));
  if (closable.length === 0) return { success: true, closedTabIds: [] };
  const remainingTabCount = tabs.length - closable.length;
  const toClose = remainingTabCount > 0 ? closable : closable.slice(0, Math.max(0, tabs.length - 1));
  if (toClose.length > 0) await browser.tabs.remove(toClose);
  return { success: true, closedTabIds: toClose };
}

if (browser.tabs.onRemoved?.addListener) {
  browser.tabs.onRemoved.addListener((tabId) => forgetRemovedTab(tabId));
}

function normalizeBridgeSettings(value = {}) {
  const settings = { ...DEFAULT_BRIDGE_SETTINGS, ...value };
  const urlText = String(settings.url).trim();
  const url = new URL(urlText);

  if (url.protocol !== "ws:" && url.protocol !== "wss:") {
    throw new Error("Bridge URL must use ws: or wss:");
  }

  const reconnectMs = Number(settings.reconnectInterval);
  if (!Number.isFinite(reconnectMs) || reconnectMs < 500) {
    throw new Error("Reconnect interval must be at least 500 ms");
  }

  if (typeof settings.autoConnect !== "boolean") {
    throw new Error("Auto connect must be true or false");
  }

  return {
    url: urlText,
    reconnectInterval: reconnectMs,
    autoConnect: settings.autoConnect,
  };
}

async function loadBridgeSettings() {
  const result = await browser.storage.local.get("bridgeSettings");
  return normalizeBridgeSettings(result.bridgeSettings ?? {});
}

function setBridgeStatus(status) {
  return browser.storage.local.set({ bridgeStatus: status });
}

function getZenMcp() {
  if (!browser?.zenMcp) {
    throw new Error(
      "Firefox Experiment API is not available; enable extensions.experiments.enabled"
    );
  }
  return browser.zenMcp;
}

function diagnoseExperiment() {
  const manifest = browser.runtime.getManifest();
  return {
    extensionId: browser.runtime.id,
    manifestVersion: manifest.version,
    experimentApis: manifest.experiment_apis ?? null,
    zenMcpAvailable: Boolean(browser?.zenMcp),
    zenMcpKeys: browser?.zenMcp ? Object.keys(browser.zenMcp) : [],
    browserKeys: Object.keys(browser).sort(),
  };
}

async function getTargetTab(args = {}, context = {}) {
  if (!Number.isInteger(args.tabId) || args.tabId < 0) {
    throw new Error("tabId is required and must be a non-negative integer");
  }
  let tab;
  try {
    tab = await browser.tabs.get(args.tabId);
  } catch {
    throw new Error(`Tab not found: ${args.tabId}`);
  }
  if (tab?.id === undefined || tab?.id === null) {
    throw new Error(`Tab not found: ${args.tabId}`);
  }
  if (args.workspaceId) {
    let workspaceTabs;
    try {
      workspaceTabs = await listWorkspaceTabsWithBrowserIds(args.workspaceId);
    } catch (error) {
      throw new Error(`Unable to validate workspace ${args.workspaceId}: ${String(error)}`);
    }
    if (!workspaceTabs.tabs.some((item) => item.tabId === args.tabId)) {
      throw new Error(`Tab ${args.tabId} does not belong to workspace ${args.workspaceId}`);
    }
  }
  if (args.expectedUrl !== undefined && args.expectedUrl !== tab.url) {
    throw new Error(`Tab ${args.tabId} changed URL; expected ${args.expectedUrl}, found ${tab.url ?? ""}`);
  }
  return tab;
}

async function listWorkspaceTabsWithBrowserIds(workspaceId) {
  const result = await getZenMcp().listWorkspaceTabs(workspaceId);
  const browserTabs = await browser.tabs.query({ currentWindow: true });
  const used = new Set();
  const tabs = result.tabs.map((item) => {
    const match = browserTabs.find((candidate) =>
      !used.has(candidate.id) &&
      (candidate.url ?? "") === item.url &&
      (candidate.title ?? "") === item.title
    );
    if (match) used.add(match.id);
    return { ...item, tabId: match?.id ?? null, windowId: match?.windowId ?? null };
  });
  return { ...result, tabs };
}

async function listBrowserPages() {
  const [tabs, activeTabs] = await Promise.all([
    browser.tabs.query({ currentWindow: true }),
    browser.tabs.query({ active: true, currentWindow: true }),
  ]);
  const activeId = activeTabs[0]?.id;
  return {
    pages: tabs.map((tab, index) => ({
      index,
      tabId: tab.id,
      windowId: tab.windowId,
      url: tab.url ?? "",
      title: tab.title ?? "",
      isActive: tab.id === activeId,
    })),
    activePageIndex: Math.max(0, tabs.findIndex((tab) => tab.id === activeId)),
  };
}

async function markCurrentBrowserTabs(sessionId) {
  const tabs = await browser.tabs.query({ currentWindow: true });
  for (const tab of tabs) touchSessionTab(sessionId, tab.id);
}

async function trackStructureOperation(context, operation) {
  await markCurrentBrowserTabs(sessionIdFor(context));
  return operation();
}

async function callPageTool(toolName, args = {}, context = {}) {
  const tab = await getTargetTab(args, context);
  const sessionId = sessionIdFor(context);
  touchSessionTab(sessionId, tab.id);
  const message = {
    type: "zen-mcp-page-tool",
    toolName,
    args,
  };
  try {
    const result = await browser.tabs.sendMessage(tab.id, message);
    return { ...result, tabId: tab.id, url: tab.url ?? result?.url ?? "", executionMode: "content-script" };
  } catch (messageError) {
    try {
      await browser.tabs.executeScript(tab.id, { file: "content-script.js" });
      const result = await browser.tabs.sendMessage(tab.id, message);
      return { ...result, tabId: tab.id, url: tab.url ?? result?.url ?? "", executionMode: "content-script-injected" };
    } catch (injectionError) {
      // Built-in pages and tabs without host permission require a selected-tab
      // fallback. The original injection error remains visible to callers.
      return withTabSwitchLock(sessionId, context, async () => {
        await browser.tabs.update(tab.id, { active: true });
        const code = `(${pageToolRunner})(${JSON.stringify(toolName)}, ${JSON.stringify(args)})`;
        try {
          const results = await browser.tabs.executeScript(tab.id, { code });
          return {
            ...(results?.[0] ?? {}),
            tabId: tab.id,
            url: tab.url ?? results?.[0]?.url ?? "",
            executionMode: "selected-tab-fallback",
            injectionError: String(injectionError),
          };
        } catch (fallbackError) {
          throw new Error(`Page tool unavailable for tab ${tab.id}: ${String(fallbackError)}; content script: ${String(messageError)}`);
        }
      });
    }
  }
}

async function navigatePage(url, args = {}, context = {}) {
  if (!url || url.trim() === "") {
    throw new Error("URL cannot be empty");
  }
  try {
    new URL(url);
  } catch {
    throw new Error(`Invalid URL: ${url}`);
  }
  const tab = await getTargetTab(args, context);
  touchSessionTab(sessionIdFor(context), tab.id);
  await browser.tabs.update(tab.id, { url });
  return { success: true, tabId: tab.id, url };
}

async function selectBrowserPage(pageIndex, context = {}) {
  const tabs = await browser.tabs.query({ currentWindow: true });
  if (pageIndex < 0 || pageIndex >= tabs.length) {
    throw new Error(`pageIndex ${pageIndex} out of bounds (window has ${tabs.length} tabs)`);
  }
  const sessionId = sessionIdFor(context);
  touchSessionTab(sessionId, tabs[pageIndex].id);
  return withTabSwitchLock(sessionId, context, async () => {
    await browser.tabs.update(tabs[pageIndex].id, { active: true });
    return { success: true, pageIndex };
  });
}

async function newBrowserTab(url, context = {}) {
  if (url) {
    try {
      new URL(url);
    } catch {
      throw new Error(`Invalid URL: ${url}`);
    }
  }
  const sessionId = sessionIdFor(context);
  return withTabSwitchLock(sessionId, context, async () => {
    const tab = await browser.tabs.create(url ? { url } : {});
    touchSessionTab(sessionId, tab.id);
    const tabs = await browser.tabs.query({ currentWindow: true });
    return { success: true, tabIndex: tabs.findIndex((item) => item.id === tab.id), tabId: tab.id, url: tab.url ?? url ?? "" };
  });
}

async function reloadBrowserTab(args = {}, context = {}) {
  const tab = await getTargetTab(args, context);
  touchSessionTab(sessionIdFor(context), tab.id);
  await browser.tabs.reload(tab.id, { bypassCache: Boolean(args.bypassCache) });
  return { success: true, tabId: tab.id, url: tab.url ?? "", bypassCache: Boolean(args.bypassCache) };
}

async function closeBrowserTab(tabIndex, context = {}) {
  const tabs = await browser.tabs.query({ currentWindow: true });
  if (tabs.length <= 1) {
    throw new Error("Cannot close the last tab");
  }
  if (tabIndex < 0 || tabIndex >= tabs.length) {
    throw new Error(`tabIndex ${tabIndex} out of bounds (window has ${tabs.length} tabs)`);
  }
  const sessionId = sessionIdFor(context);
  touchSessionTab(sessionId, tabs[tabIndex].id);
  return withTabSwitchLock(sessionId, context, async () => {
    await browser.tabs.remove(tabs[tabIndex].id);
    return { success: true, tabIndex };
  });
}

async function screenshotPage(args = {}, context = {}) {
  const tab = await getTargetTab(args, context);
  const sessionId = sessionIdFor(context);
  touchSessionTab(sessionId, tab.id);
  return withTabSwitchLock(sessionId, context, async () => {
    // Firefox capture APIs capture the visible window, not an arbitrary hidden
    // tab. Selecting the target is therefore required and intentional here.
    await browser.tabs.update(tab.id, { active: true });
    const data = await browser.tabs.captureVisibleTab(tab.windowId, { format: "png" });
    return { data, tabId: tab.id, url: tab.url ?? "", title: tab.title ?? "", executionMode: "selected-tab" };
  });
}

const resourceQueues = new Map();

function serializedTool(toolName, args, toolFn) {
  const key = args?.workspaceId !== undefined
    ? `workspace:${args.workspaceId}`
    : args?.tabId !== undefined
      ? `tab:${args.tabId}`
      : toolName.startsWith("move_tab") || toolName.startsWith("manage_")
        ? "browser-structure"
        : null;
  if (!key) return toolFn();

  const previous = resourceQueues.get(key) ?? Promise.resolve();
  const current = previous.catch(() => {}).then(toolFn);
  const cleanup = () => {
    if (resourceQueues.get(key) === tracked) resourceQueues.delete(key);
  };
  const tracked = current.then(cleanup, cleanup);
  resourceQueues.set(key, tracked);
  return current;
}

function pageToolRunner(toolName, args) {
  const cssEscape = (value) => {
    if (window.CSS?.escape) return CSS.escape(value);
    return String(value).replace(/"/g, '\\"');
  };
  const generateSelector = (el, index = 0) => {
    if (el.id) return `#${cssEscape(el.id)}`;
    if (el.getAttribute("name")) return `${el.tagName.toLowerCase()}[name="${cssEscape(el.getAttribute("name"))}"]`;
    if (typeof el.className === "string" && el.className.trim()) {
      return `.${el.className.trim().split(/\s+/).map(cssEscape).join(".")}`;
    }
    return `${el.tagName.toLowerCase()}:nth-child(${index + 1})`;
  };
  const requireSelector = (selector) => {
    if (!selector || selector.trim() === "") throw new Error("Selector cannot be empty");
    const element = document.querySelector(selector);
    if (!element) throw new Error(`Element not found: ${selector}`);
    return element;
  };
  const visibleText = () => {
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
      acceptNode(node) {
        const parent = node.parentElement;
        if (!parent) return NodeFilter.FILTER_REJECT;
        const tag = parent.tagName.toLowerCase();
        if (["script", "style", "noscript"].includes(tag)) return NodeFilter.FILTER_REJECT;
        const style = window.getComputedStyle(parent);
        if (style.display === "none" || style.visibility === "hidden") return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
      },
    });
    const parts = [];
    let node;
    while ((node = walker.nextNode())) {
      const text = node.textContent?.trim();
      if (text) parts.push(text);
    }
    return parts.join(" ").substring(0, 10000);
  };
  const isInteractive = (el) => ["a", "button", "input", "select", "textarea"].includes(el.tagName.toLowerCase()) || el.hasAttribute("onclick") || el.hasAttribute("tabindex");
  const isForm = (el) => ["input", "select", "textarea", "button"].includes(el.tagName.toLowerCase());
  const setNativeValue = (element, value) => {
    element.value = value;
    element.dispatchEvent(new Event("input", { bubbles: true }));
    element.dispatchEvent(new Event("change", { bubbles: true }));
  };

  switch (toolName) {
    case "snapshot": {
      const filter = args.filter || "all";
      const elements = Array.from(document.querySelectorAll("*")).slice(0, 150);
      const snapshot = elements.filter((el) => filter === "all" || (filter === "interactive" && isInteractive(el)) || (filter === "form" && isForm(el))).map((el, index) => {
        const tag = el.tagName.toLowerCase();
        const text = (el.textContent || "").trim().substring(0, 50);
        return `<${tag} selector="${generateSelector(el, index)}">${text}</${tag}>`;
      }).join("\n") || "No elements found";
      return { snapshot, url: location.href, title: document.title };
    }
    case "get_page_text":
      return { url: location.href, title: document.title, text: visibleText() };
    case "get_form_fields":
      return { url: location.href, title: document.title, fields: Array.from(document.querySelectorAll("input, select, textarea")).map((el, index) => ({
        name: el.getAttribute("name") || "",
        type: el.getAttribute("type") || el.tagName.toLowerCase(),
        label: el.labels?.[0]?.textContent?.trim() || el.getAttribute("placeholder") || el.getAttribute("aria-label") || "",
        value: el.value || "",
        selector: generateSelector(el, index),
        options: el.tagName.toLowerCase() === "select" ? Array.from(el.options).map((option) => option.text || option.value) : undefined,
      })) };
    case "click": {
      const element = requireSelector(args.selector);
      element.click();
      return { success: true, selector: args.selector };
    }
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
        if (field.action === "fill") pageToolRunner("fill", field);
        else if (field.action === "select") pageToolRunner("select_option", { ...field, by: field.by || "value" });
        else if (field.action === "check") pageToolRunner("check", { ...field, checked: true });
        else if (field.action === "uncheck") pageToolRunner("check", { ...field, checked: false });
        else if (field.action === "click") pageToolRunner("click", field);
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
      if (args.text && document.body.innerText.includes(args.text)) return { success: true, found: true, text: args.text };
      throw new Error("Element or text not found");
    default:
      throw new Error(`Unsupported page tool: ${toolName}`);
  }
}

const emptyInputSchema = { type: "object", properties: {}, additionalProperties: false };

function objectInputSchema(properties = {}, required = []) {
  const schema = { type: "object", properties, additionalProperties: false };
  if (required.length > 0) {
    schema.required = required;
  }
  return schema;
}

const nonNegativeIntegerSchema = { type: "integer", minimum: 0 };
const pageTargetProperties = {
  tabId: nonNegativeIntegerSchema,
  workspaceId: { type: "string" },
  expectedUrl: { type: "string" },
};

const SEARCH_ENGINES = ["google", "bing", "duckduckgo", "arxiv", "bioarxiv", "pubmed", "google_scholar"];

function buildSearchUrl(engine, query, page = 1) {
  if (!SEARCH_ENGINES.includes(engine)) throw new Error(`Unsupported search engine: ${engine}`);
  if (!String(query ?? "").trim()) throw new Error("Search query cannot be empty");
  if (!Number.isInteger(page) || page < 1) throw new Error("Search page must be a positive integer");
  const encoded = encodeURIComponent(query);
  const urls = {
    google: `https://www.google.com/search?q=${encoded}&start=${(page - 1) * 10}`,
    bing: `https://www.bing.com/search?q=${encoded}&first=${(page - 1) * 10 + 1}`,
    duckduckgo: `https://noai.duckduckgo.com/?q=${encoded}&ia=web${page > 1 ? `&s=${(page - 1) * 30}` : ""}`,
    arxiv: `https://arxiv.org/search/?query=${encoded}&searchtype=all&abstracts=show&order=-announced_date_first&size=50&page=${page}`,
    bioarxiv: `https://www.biorxiv.org/search/${encoded.replace(/%20/g, "+")}?page=${page}`,
    pubmed: `https://pubmed.ncbi.nlm.nih.gov/?term=${encoded}&page=${page}`,
    google_scholar: `https://scholar.google.com/scholar?q=${encoded}&start=${(page - 1) * 10}`,
  };
  return urls[engine];
}

function resolveSearchUrl(args = {}) {
  const page = args.page ?? 1;
  if (!Number.isInteger(page) || page < 1) throw new Error("Search page must be a positive integer");
  if (args.searchUrl) {
    const query = String(args.query ?? "");
    const template = String(args.searchUrl);
    const resolved = template.replaceAll("{query}", encodeURIComponent(query)).replaceAll("{page}", String(page));
    if (template.includes("{query}") && !query.trim()) throw new Error("query is required when searchUrl contains {query}");
    let parsed;
    try {
      parsed = new URL(resolved);
    } catch {
      throw new Error(`Invalid search URL: ${template}`);
    }
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") throw new Error("Search URL must use http: or https:");
    return { engine: "custom", query, page, searchUrl: resolved };
  }
  if (!args.engine) throw new Error("Either engine or searchUrl must be provided");
  const query = String(args.query ?? "");
  return { engine: args.engine, query, page, searchUrl: buildSearchUrl(args.engine, query, page) };
}

async function waitForTabComplete(tabId, timeout) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    let tab;
    try {
      tab = await browser.tabs.get(tabId);
    } catch {
      throw new Error(`Search tab was closed before loading: ${tabId}`);
    }
    if (tab?.status === "complete") return tab;
    await new Promise((resolve) => setTimeout(resolve, Math.min(100, Math.max(1, deadline - Date.now()))));
  }
  throw new Error(`Search page did not finish loading within ${timeout} milliseconds`);
}

async function searchPage(args = {}, context = {}) {
  const resolved = resolveSearchUrl(args);
  const timeout = Number(args.timeout ?? 30000);
  if (!Number.isInteger(timeout) || timeout < 0 || timeout > 120000) {
    throw new Error("Search timeout must be between 0 and 120000 milliseconds");
  }
  const sessionId = sessionIdFor(context);
  let tab;
  let extractionError;
  try {
    tab = await browser.tabs.create({ url: resolved.searchUrl, active: false });
    touchSessionTab(sessionId, tab.id);
    await waitForTabComplete(tab.id, timeout);
    const page = await callPageTool("get_page_text", { tabId: tab.id }, context);
    const finalTab = await browser.tabs.get(tab.id);
    return {
      success: true,
      engine: resolved.engine,
      query: resolved.query,
      page: resolved.page,
      searchUrl: resolved.searchUrl,
      finalUrl: finalTab?.url ?? page?.url ?? resolved.searchUrl,
      title: finalTab?.title ?? page?.title ?? "",
      text: page?.text ?? "",
      tabId: tab.id,
      closed: true,
    };
  } catch (error) {
    extractionError = error;
    if (error && typeof error === "object") {
      error.searchUrl = resolved.searchUrl;
      error.engine = resolved.engine;
      error.page = resolved.page;
    }
    throw error;
  } finally {
    if (tab?.id !== undefined) {
      try {
        await browser.tabs.remove(tab.id);
      } catch (closeError) {
        if (!extractionError) {
          if (closeError && typeof closeError === "object") {
            closeError.searchUrl = resolved.searchUrl;
            closeError.engine = resolved.engine;
            closeError.page = resolved.page;
          }
          throw closeError;
        }
      }
    }
  }
}

const toolInputSchemas = {
  zen_list_workspaces: emptyInputSchema,
  zen_list_workspace_tabs: objectInputSchema({ workspaceId: { type: "string" } }),
  zen_move_tab_in_workspace: objectInputSchema({ tabIndex: nonNegativeIntegerSchema, newIndex: nonNegativeIntegerSchema, workspaceId: { type: "string" } }, ["tabIndex", "newIndex"]),
  zen_move_tab_to_workspace: objectInputSchema({ tabIndex: nonNegativeIntegerSchema, targetWorkspaceId: { type: "string" }, sourceWorkspaceId: { type: "string" } }, ["tabIndex", "targetWorkspaceId"]),
  zen_manage_workspace: objectInputSchema({ action: { type: "string", enum: ["create", "rename", "delete"] }, workspaceId: { type: "string" }, name: { type: "string" } }, ["action"]),
  zen_list_folders: objectInputSchema({ workspaceId: { type: "string" } }),
  zen_manage_folder: objectInputSchema({ action: { type: "string", enum: ["create", "rename", "delete", "unpack"] }, workspaceId: { type: "string" }, folderId: { type: "string" }, title: { type: "string" }, tabIndices: { type: "array", items: nonNegativeIntegerSchema } }, ["action"]),
  zen_move_tab_to_folder: objectInputSchema({ tabIndex: nonNegativeIntegerSchema, folderId: { type: "string" }, workspaceId: { type: "string" } }, ["tabIndex", "folderId"]),
  zen_move_tab_out_of_folder: objectInputSchema({ folderId: { type: "string" }, tabIndex: nonNegativeIntegerSchema, workspaceId: { type: "string" } }, ["folderId", "tabIndex"]),
  zen_list_top_pinned_tabs: objectInputSchema({ workspaceId: { type: "string" } }),
  zen_manage_top_pinned_tab: objectInputSchema({ action: { type: "string", enum: ["pin", "unpin", "move"] }, tabIndex: nonNegativeIntegerSchema, newIndex: nonNegativeIntegerSchema, workspaceId: { type: "string" } }, ["action", "tabIndex"]),
  zen_navigate: objectInputSchema({ ...pageTargetProperties, url: { type: "string" } }, ["tabId", "url"]),
  zen_reload: objectInputSchema({ ...pageTargetProperties, bypassCache: { type: "boolean" } }, ["tabId"]),
  zen_search: objectInputSchema({ engine: { type: "string", enum: SEARCH_ENGINES }, query: { type: "string" }, page: { type: "integer", minimum: 1 }, searchUrl: { type: "string" }, timeout: nonNegativeIntegerSchema }),
  zen_list_pages: emptyInputSchema,
  zen_select_page: objectInputSchema({ pageIndex: nonNegativeIntegerSchema }, ["pageIndex"]),
  zen_new_tab: objectInputSchema({ url: { type: "string" } }),
  zen_close_tab: objectInputSchema({ tabIndex: nonNegativeIntegerSchema }, ["tabIndex"]),
  zen_snapshot: objectInputSchema({ ...pageTargetProperties, filter: { type: "string", enum: ["all", "interactive", "form"] } }, ["tabId"]),
  zen_screenshot: objectInputSchema(pageTargetProperties, ["tabId"]),
  zen_get_page_text: objectInputSchema(pageTargetProperties, ["tabId"]),
  zen_get_form_fields: objectInputSchema(pageTargetProperties, ["tabId"]),
  zen_click: objectInputSchema({ ...pageTargetProperties, selector: { type: "string" } }, ["tabId", "selector"]),
  zen_fill: objectInputSchema({ ...pageTargetProperties, selector: { type: "string" }, value: { type: "string" } }, ["tabId", "selector", "value"]),
  zen_select_option: objectInputSchema({ ...pageTargetProperties, selector: { type: "string" }, value: { type: "string" }, by: { type: "string", enum: ["value", "text"] } }, ["tabId", "selector", "value"]),
  zen_check: objectInputSchema({ ...pageTargetProperties, selector: { type: "string" }, checked: { type: "boolean" } }, ["tabId", "selector", "checked"]),
  zen_press_key: objectInputSchema({ ...pageTargetProperties, key: { type: "string" } }, ["tabId", "key"]),
  zen_fill_form: objectInputSchema({ ...pageTargetProperties, fields: { type: "array", items: { type: "object", properties: { selector: { type: "string" }, action: { type: "string", enum: ["fill", "select", "check", "uncheck", "click"] }, value: { type: "string" }, by: { type: "string", enum: ["value", "text"] } }, required: ["selector", "action"], additionalProperties: false } } }, ["tabId", "fields"]),
  zen_scroll: objectInputSchema({ ...pageTargetProperties, direction: { type: "string", enum: ["up", "down", "left", "right"] }, amount: { type: "number" }, selector: { type: "string" } }, ["tabId", "direction"]),
  zen_evaluate: objectInputSchema({ ...pageTargetProperties, script: { type: "string" } }, ["tabId", "script"]),
  zen_wait: objectInputSchema({ milliseconds: nonNegativeIntegerSchema }),
  zen_wait_for: objectInputSchema({ ...pageTargetProperties, selector: { type: "string" }, text: { type: "string" }, timeout: nonNegativeIntegerSchema }, ["tabId"]),
  zen_reconnect: emptyInputSchema,
  zen_diagnose_experiment: emptyInputSchema,
  zen_diagnose_parent: emptyInputSchema,
  zen_diagnose_ping: emptyInputSchema,
  zen_acquire_tab_switch_lock: objectInputSchema({ leaseMs: nonNegativeIntegerSchema }),
  zen_release_tab_switch_lock: emptyInputSchema,
  zen_get_tab_switch_lock: emptyInputSchema,
  zen_network_start: objectInputSchema({ tabId: nonNegativeIntegerSchema }, ["tabId"]),
  zen_network_stop: objectInputSchema({ networkSessionId: { type: "string" }, tabId: nonNegativeIntegerSchema }, ["networkSessionId", "tabId"]),
  zen_network_list: objectInputSchema({ networkSessionId: { type: "string" }, tabId: nonNegativeIntegerSchema, category: { type: "string" }, urlKeyword: { type: "string" }, pageKeyword: { type: "string" }, method: { type: "string" }, statusCode: { type: "integer" }, limit: { type: "integer", minimum: 1, maximum: 100 }, offset: { type: "integer", minimum: 0 } }, ["networkSessionId", "tabId"]),
  zen_network_get_request: objectInputSchema({ networkSessionId: { type: "string" }, tabId: nonNegativeIntegerSchema, recordId: { type: "string" } }, ["networkSessionId", "tabId", "recordId"]),
  zen_network_get_response: objectInputSchema({ networkSessionId: { type: "string" }, tabId: nonNegativeIntegerSchema, recordId: { type: "string" } }, ["networkSessionId", "tabId", "recordId"]),
  zen_network_replay: objectInputSchema({ networkSessionId: { type: "string" }, tabId: nonNegativeIntegerSchema, recordId: { type: "string" }, methodOverride: { type: "string" }, headerOverrides: { type: "array" }, bodyOverride: {} }, ["networkSessionId", "tabId", "recordId"]),
  zen_network_replay_with_response: objectInputSchema({ networkSessionId: { type: "string" }, tabId: nonNegativeIntegerSchema, recordId: { type: "string" }, responseOverride: { type: "object" } }, ["networkSessionId", "tabId", "recordId", "responseOverride"]),
};

function toolMetadata(name, description) {
  return { name, description, inputSchema: toolInputSchemas[name] ?? emptyInputSchema };
}

function requestContext(request) {
  return {
    sessionId: request?._zenMcpSessionId || "legacy-session",
    switchLockTimeout: request?._zenMcpSwitchLockTimeout,
  };
}

function formatToolError(error) {
  if (error?.code === "TAB_SWITCH_LOCK_CONFLICT") {
    return JSON.stringify({
      code: error.code,
      message: error.message,
      lockOwnerSessionId: error.lockOwnerSessionId,
      expiresAt: error.expiresAt,
      remainingMs: error.remainingMs,
    });
  }
  if (error?.searchUrl) {
    return JSON.stringify({
      code: "SEARCH_FAILED",
      message: String(error),
      engine: error.engine,
      page: error.page,
      searchUrl: error.searchUrl,
    });
  }
  return String(error);
}

// MCP request handler
function handleMCPRequest(request) {
  const { method, params, id } = request;

  if (request?.type === "zen/session-disconnected") {
    cleanupSession(request.sessionId).catch((error) => {
      console.error("Failed to clean up MCP session:", error);
    });
    return undefined;
  }

  if (id === undefined) {
    return undefined;
  }

  if (method === "tools/list") {
    return {
      jsonrpc: "2.0",
      id,
      result: {
        tools: [
          toolMetadata("zen_list_workspaces", "List all workspaces"),
          toolMetadata("zen_list_workspace_tabs", "List tabs in a workspace"),
          toolMetadata("zen_move_tab_in_workspace", "Move tab within workspace"),
          toolMetadata("zen_move_tab_to_workspace", "Move tab to another workspace"),
          toolMetadata("zen_manage_workspace", "Create/delete/rename workspace"),
          toolMetadata("zen_list_folders", "List folders in a workspace"),
          toolMetadata("zen_manage_folder", "Create/delete/rename/unpack folder"),
          toolMetadata("zen_move_tab_to_folder", "Move tab into a folder"),
          toolMetadata("zen_move_tab_out_of_folder", "Move tab out of a folder"),
          toolMetadata("zen_list_top_pinned_tabs", "List top pinned tabs in a workspace"),
          toolMetadata("zen_manage_top_pinned_tab", "Pin/unpin/move top pinned tab"),
           toolMetadata("zen_navigate", "Navigate to URL"),
           toolMetadata("zen_reload", "Reload an explicitly targeted tab"),
           toolMetadata("zen_search", "Search a built-in engine or composed URL, return loaded result-page text, and close the temporary tab"),
          toolMetadata("zen_list_pages", "List all pages"),
          toolMetadata("zen_select_page", "Select a page"),
          toolMetadata("zen_new_tab", "Open new tab"),
          toolMetadata("zen_close_tab", "Close a tab"),
          toolMetadata("zen_snapshot", "Get page snapshot"),
          toolMetadata("zen_screenshot", "Select the target tab and take a screenshot; browser visibility is required"),
          toolMetadata("zen_get_page_text", "Get page text"),
          toolMetadata("zen_get_form_fields", "Get form fields"),
          toolMetadata("zen_click", "Click element"),
          toolMetadata("zen_fill", "Fill input"),
          toolMetadata("zen_select_option", "Select option"),
          toolMetadata("zen_check", "Check/uncheck checkbox"),
          toolMetadata("zen_press_key", "Press key"),
          toolMetadata("zen_fill_form", "Fill form"),
          toolMetadata("zen_scroll", "Scroll page"),
          toolMetadata("zen_evaluate", "Evaluate JavaScript"),
          toolMetadata("zen_wait", "Wait milliseconds"),
          toolMetadata("zen_wait_for", "Wait for element"),
          toolMetadata("zen_reconnect", "Reconnect"),
          toolMetadata("zen_diagnose_experiment", "Diagnose Experiment API registration"),
          toolMetadata("zen_diagnose_parent", "Diagnose privileged Zen parent APIs"),
          toolMetadata("zen_diagnose_ping", "Verify privileged Experiment method calls"),
          toolMetadata("zen_acquire_tab_switch_lock", "Acquire or renew the active-tab switch lock"),
          toolMetadata("zen_release_tab_switch_lock", "Release the active-tab switch lock"),
           toolMetadata("zen_get_tab_switch_lock", "Get the active-tab switch lock state"),
           toolMetadata("zen_network_start", "Start a tab-scoped network capture session"),
           toolMetadata("zen_network_stop", "Stop a tab-scoped network capture session"),
           toolMetadata("zen_network_list", "List captured network requests with filters"),
           toolMetadata("zen_network_get_request", "Read a captured network request"),
           toolMetadata("zen_network_get_response", "Read a captured network response"),
           toolMetadata("zen_network_replay", "Replay a captured request using browser-managed cookies"),
           toolMetadata("zen_network_replay_with_response", "Replay a captured request with a one-shot response override"),
        ],
      },
    };
  }

  if (method === "tools/call") {
    const { name, arguments: args } = params;
    const toolName = name.replace("zen_", "");
    const context = requestContext(request);

    try {
      let result;

      const toolMap = {
        list_workspaces: () => getZenMcp().listWorkspaces(),
          list_workspace_tabs: () => listWorkspaceTabsWithBrowserIds(args?.workspaceId),
         move_tab_in_workspace: () => trackStructureOperation(context, () => getZenMcp().moveTabInWorkspace(args?.tabIndex, args?.newIndex, args?.workspaceId)),
         move_tab_to_workspace: () => trackStructureOperation(context, () => getZenMcp().moveTabToWorkspace(args?.tabIndex, args?.targetWorkspaceId, args?.sourceWorkspaceId)),
         manage_workspace: () => trackStructureOperation(context, () => getZenMcp().manageWorkspace(args?.action, args?.workspaceId, args?.name)),
        list_folders: () => getZenMcp().listFolders(args?.workspaceId),
         manage_folder: () => trackStructureOperation(context, () => getZenMcp().manageFolder(args?.action, args?.workspaceId, args?.folderId, args?.title, args?.tabIndices)),
         move_tab_to_folder: () => trackStructureOperation(context, () => getZenMcp().moveTabToFolder(args?.tabIndex, args?.folderId, args?.workspaceId)),
         move_tab_out_of_folder: () => trackStructureOperation(context, () => getZenMcp().moveTabOutOfFolder(args?.folderId, args?.tabIndex, args?.workspaceId)),
        list_top_pinned_tabs: () => getZenMcp().listTopPinnedTabs(args?.workspaceId),
         manage_top_pinned_tab: () => trackStructureOperation(context, () => getZenMcp().manageTopPinnedTab(args?.action, args?.tabIndex, args?.newIndex, args?.workspaceId)),
           navigate: () => navigatePage(args?.url, args, context),
           reload: () => reloadBrowserTab(args, context),
          search: () => searchPage(args, context),
          list_pages: () => listBrowserPages(),
         select_page: () => selectBrowserPage(args?.pageIndex, context),
         new_tab: () => newBrowserTab(args?.url, context),
         close_tab: () => closeBrowserTab(args?.tabIndex, context),
         snapshot: () => callPageTool("snapshot", args, context),
         screenshot: () => screenshotPage(args, context),
         get_page_text: () => callPageTool("get_page_text", args, context),
         get_form_fields: () => callPageTool("get_form_fields", args, context),
         click: () => callPageTool("click", args, context),
         fill: () => callPageTool("fill", args, context),
         select_option: () => callPageTool("select_option", args, context),
         check: () => callPageTool("check", args, context),
         press_key: () => callPageTool("press_key", args, context),
         fill_form: () => callPageTool("fill_form", args, context),
         scroll: () => callPageTool("scroll", args, context),
         evaluate: () => callPageTool("evaluate", args, context),
        wait: () => new Promise((resolve) => setTimeout(() => resolve({ success: true, milliseconds: args?.milliseconds }), args?.milliseconds ?? 0)),
         wait_for: () => callPageTool("wait_for", args, context),
         reconnect: () => ({ success: true }),
         acquire_tab_switch_lock: () => acquireTabSwitchLock(context.sessionId, args?.leaseMs ?? context.switchLockTimeout, true),
         release_tab_switch_lock: () => releaseTabSwitchLock(context.sessionId),
         get_tab_switch_lock: () => getTabSwitchLock(),
         network_start: () => globalThis.zenNetworkCapture.start(args, context),
         network_stop: () => globalThis.zenNetworkCapture.stop(args, context),
         network_list: () => globalThis.zenNetworkCapture.list(args, context),
         network_get_request: () => globalThis.zenNetworkCapture.getRequest(args, context),
         network_get_response: () => globalThis.zenNetworkCapture.getResponse(args, context),
         network_replay: () => globalThis.zenNetworkCapture.replay(args, context),
         network_replay_with_response: () => globalThis.zenNetworkCapture.replayWithResponse(args, context),
        diagnose_experiment: () => diagnoseExperiment(),
        diagnose_parent: () => getZenMcp().diagnoseParent(),
        diagnose_ping: () => getZenMcp().diagnosePing(),
      };

      const toolFn = toolMap[toolName];
      if (!toolFn) {
        return {
          jsonrpc: "2.0",
          id,
          error: { code: -32601, message: `Tool not found: ${name}` },
        };
      }

       result = serializedTool(toolName, args, toolFn);

      if (result && typeof result.then === "function") {
        return result.then((res) => ({
          jsonrpc: "2.0",
          id,
          result: {
            content: [{ type: "text", text: JSON.stringify(res, null, 2) }],
          },
        })).catch((err) => ({
          jsonrpc: "2.0",
          id,
          result: {
            isError: true,
             content: [{ type: "text", text: formatToolError(err) }],
          },
        }));
      }

      return {
        jsonrpc: "2.0",
        id,
        result: {
          content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
        },
      };
    } catch (err) {
      return {
        jsonrpc: "2.0",
        id,
        result: {
          isError: true,
           content: [{ type: "text", text: formatToolError(err) }],
        },
      };
    }
  }

  if (method === "initialize") {
    return {
      jsonrpc: "2.0",
      id,
      result: {
        protocolVersion: "2024-11-05",
        capabilities: { tools: {} },
        serverInfo: { name: "zen-mcp", version: "0.1.2" },
      },
    };
  }

  return {
    jsonrpc: "2.0",
    id,
    error: { code: -32601, message: `Method not found: ${method}` },
  };
}

const bridgeConnection = createBridgeConnectionManager({
  WebSocketCtor: WebSocket,
  setStatus: setBridgeStatus,
  handleMessage: handleMCPRequest,
  log: console.log.bind(console),
  logError: console.error.bind(console),
});

async function startBridgeConnection() {
  try {
    const settings = await loadBridgeSettings();
    if (settings.autoConnect) {
      bridgeConnection.connect(settings);
    } else {
      setBridgeStatus("disabled");
    }
  } catch (err) {
    console.error("Failed to load bridge settings:", err);
    bridgeConnection.connect(normalizeBridgeSettings(DEFAULT_BRIDGE_SETTINGS));
  }
}

function applyBridgeSettings(settings) {
  bridgeConnection.stop();

  if (settings.autoConnect) {
    bridgeConnection.connect(settings);
  } else {
    setBridgeStatus("disabled");
  }
}

function handleBridgeSettingsChanged(changes, areaName) {
  if (areaName !== "local" || !changes.bridgeSettings) {
    return;
  }

  try {
    applyBridgeSettings(normalizeBridgeSettings(changes.bridgeSettings.newValue ?? {}));
  } catch (err) {
    console.error("Invalid bridge settings:", err);
    bridgeConnection.stop();
    setBridgeStatus(`error: ${err}`);
  }
}

browser.storage.onChanged.addListener(handleBridgeSettingsChanged);

startBridgeConnection();

console.log("MCP extension initialized");
