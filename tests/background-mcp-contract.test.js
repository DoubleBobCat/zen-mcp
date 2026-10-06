import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";

function loadBackground() {
  const context = {
    URL,
    WebSocket: class {},
    console: { log() {}, error() {} },
    setTimeout,
    clearTimeout,
    browser: {
      runtime: {
        id: "zen-mcp@example.com",
        getManifest() {
          return { version: "0.1.2", experiment_apis: { zenMcp: {} } };
        },
      },
      storage: {
        local: {
          async get() {
            return { bridgeSettings: { autoConnect: false } };
          },
          async set() {},
        },
        onChanged: { addListener() {} },
      },
      tabs: {
        async query() {
          return [];
        },
        async get(tabId) {
          return { id: tabId, windowId: 1, url: "https://example.com", title: "Example" };
        },
        async executeScript() {
          return [{ success: true }];
        },
        async sendMessage() {
          return { success: true, url: "https://example.com" };
        },
        async captureVisibleTab() {
          return "data:image/png;base64,test";
        },
        async create() {
          return { id: 99, windowId: 1, url: "https://created.example.com", title: "Created" };
        },
        async remove() {},
        onRemoved: { addListener() {} },
      },
      zenMcp: {
        async listWorkspaceTabs() {
          return {
            workspace: { uuid: "workspace-1", name: "Test", icon: "" },
            tabs: [{ index: 0, url: "https://example.com", title: "Example", pinned: false, isActive: true }],
          };
        },
        async validateTabWorkspace() {
          return { success: true };
        },
      },
    },
    createBridgeConnectionManager() {
      return { connect() {}, stop() {} };
    },
    globalThis: null,
  };
  context.globalThis = context;
  vm.runInNewContext(readFileSync("src/extension/background.js", "utf8"), context);
  return context;
}

test("tools/list returns MCP tool schemas", () => {
  const context = loadBackground();

  const response = context.handleMCPRequest({ jsonrpc: "2.0", id: "tools", method: "tools/list" });

  assert.equal(response.jsonrpc, "2.0");
  assert.equal(response.id, "tools");
  assert.ok(Array.isArray(response.result.tools));
  for (const tool of response.result.tools) {
    assert.equal(typeof tool.name, "string");
    assert.equal(typeof tool.description, "string");
    assert.equal(tool.inputSchema?.type, "object", `${tool.name} is missing an object inputSchema`);
    assert.ok(tool.inputSchema.properties, `${tool.name} is missing inputSchema.properties`);
    if (tool.inputSchema.required) {
      assert.ok(tool.inputSchema.required.length > 0, `${tool.name} should omit empty required arrays`);
    }
  }
});

test("notifications/initialized does not produce a JSON-RPC response", () => {
  const context = loadBackground();

  const response = context.handleMCPRequest({ jsonrpc: "2.0", method: "notifications/initialized" });

  assert.equal(response, undefined);
});

test("page tools target the requested tab without selecting it", async () => {
  const context = loadBackground();
  const calls = [];
  context.browser.tabs.sendMessage = async (tabId, message) => {
    calls.push({ tabId, message });
    return { success: true, url: "https://example.com" };
  };

  const response = await context.handleMCPRequest({
    jsonrpc: "2.0",
    id: "targeted",
    method: "tools/call",
    params: {
      name: "zen_get_page_text",
      arguments: { tabId: 42 },
    },
  });

  assert.equal(JSON.stringify(calls), JSON.stringify([{
    tabId: 42,
    message: {
      type: "zen-mcp-page-tool",
      toolName: "get_page_text",
      args: { tabId: 42 },
    },
  }]));
  assert.equal(response.id, "targeted");
  assert.equal(response.result.isError, undefined);
});

test("page tools reject a tab whose URL changed since the read", async () => {
  const context = loadBackground();
  context.browser.tabs.get = async (tabId) => ({
    id: tabId,
    windowId: 1,
    url: "https://new.example.com",
    title: "New page",
  });

  const response = await context.handleMCPRequest({
    jsonrpc: "2.0",
    id: "stale",
    method: "tools/call",
    params: {
      name: "zen_click",
      arguments: {
        tabId: 42,
        selector: "#submit",
        expectedUrl: "https://old.example.com",
      },
    },
  });

  assert.equal(response.id, "stale");
  assert.equal(response.result.isError, true);
  assert.match(response.result.content[0].text, /changed URL/);
});

test("page tools expose workspace validation failures", () => {
  const source = readFileSync("src/extension/background.js", "utf8");
  assert.match(source, /Unable to validate workspace/);
});

test("page tools fall back to selecting when no content script is available", async () => {
  const context = loadBackground();
  let selected = false;
  context.browser.tabs.sendMessage = async () => { throw new Error("Receiving end does not exist"); };
  context.browser.tabs.update = async (tabId, update) => {
    selected = tabId === 42 && update.active === true;
    return { id: tabId };
  };
  const response = await context.handleMCPRequest({
    jsonrpc: "2.0",
    id: "fallback",
    method: "tools/call",
    params: { name: "zen_get_page_text", arguments: { tabId: 42 } },
  });
  assert.equal(selected, true);
  assert.equal(response.result.content[0].text.includes('"executionMode": "selected-tab-fallback"'), true);
});

test("screenshots select the target tab before capturing", async () => {
  const context = loadBackground();
  const calls = [];
  context.browser.tabs.update = async (tabId, update) => calls.push(["update", tabId, update]);
  context.browser.tabs.captureVisibleTab = async (windowId) => {
    calls.push(["capture", windowId]);
    return "data:image/png;base64,test";
  };
  const response = await context.handleMCPRequest({
    jsonrpc: "2.0",
    id: "screenshot",
    method: "tools/call",
    params: { name: "zen_screenshot", arguments: { tabId: 42 } },
  });
  assert.equal(JSON.stringify(calls), JSON.stringify([["update", 42, { active: true }], ["capture", 1]]));
  assert.equal(response.result.content[0].text.includes('"executionMode": "selected-tab"'), true);
});

test("search loads a temporary result tab, extracts text, and closes it", async () => {
  const context = loadBackground();
  const removed = [];
  context.browser.tabs.create = async (properties) => ({ id: 77, windowId: 1, url: properties.url, title: "Search", status: "loading" });
  context.browser.tabs.get = async (tabId) => ({ id: tabId, windowId: 1, url: "https://www.google.com/search?q=Zen%20Browser&start=10", title: "Zen Browser - Google Search", status: "complete" });
  context.browser.tabs.sendMessage = async () => ({ url: "https://www.google.com/search?q=Zen%20Browser&start=10", title: "Zen Browser - Google Search", text: "result text" });
  context.browser.tabs.remove = async (tabId) => removed.push(tabId);

  const response = await context.handleMCPRequest({
    jsonrpc: "2.0",
    id: "search",
    method: "tools/call",
    params: { name: "zen_search", arguments: { engine: "google", query: "Zen Browser", page: 2 } },
  });

  const result = JSON.parse(response.result.content[0].text);
  assert.equal(result.success, true);
  assert.equal(result.searchUrl, "https://www.google.com/search?q=Zen%20Browser&start=10");
  assert.equal(result.finalUrl, "https://www.google.com/search?q=Zen%20Browser&start=10");
  assert.equal(result.text, "result text");
  assert.equal(result.closed, true);
  assert.deepEqual(removed, [77]);
});

test("search supports composed URLs and cleans up when extraction fails", async () => {
  const context = loadBackground();
  const removed = [];
  context.browser.tabs.create = async (properties) => ({ id: 78, windowId: 1, url: properties.url, status: "loading" });
  context.browser.tabs.get = async (tabId) => ({ id: tabId, windowId: 1, url: "https://example.com/search?q=hello%20world&page=3", title: "Results", status: "complete" });
  context.browser.tabs.update = async () => ({ id: 78 });
  context.browser.tabs.executeScript = async () => { throw new Error("fallback unavailable"); };
  context.browser.tabs.sendMessage = async () => { throw new Error("page extraction failed"); };
  context.browser.tabs.remove = async (tabId) => removed.push(tabId);

  const response = await context.handleMCPRequest({
    jsonrpc: "2.0",
    id: "custom-search",
    method: "tools/call",
    params: { name: "zen_search", arguments: { query: "hello world", page: 3, searchUrl: "https://example.com/search?q={query}&page={page}" } },
  });

  assert.equal(response.result.isError, true);
  assert.match(response.result.content[0].text, /page extraction failed/);
  assert.match(response.result.content[0].text, /https:\/\/example.com\/search\?q=hello%20world&page=3/);
  assert.deepEqual(removed, [78]);
});

test("switch lock reports conflicts between MCP sessions", async () => {
  const context = loadBackground();
  context.browser.tabs.query = async () => [
    { id: 41, windowId: 1, url: "https://one.example.com", title: "One" },
    { id: 42, windowId: 1, url: "https://two.example.com", title: "Two" },
  ];
  context.browser.tabs.update = async () => ({ id: 41 });

  const acquired = await context.handleMCPRequest({
    jsonrpc: "2.0",
    id: "lock-a",
    _zenMcpSessionId: "session-a",
    method: "tools/call",
    params: { name: "zen_acquire_tab_switch_lock", arguments: { leaseMs: 1000 } },
  });
  assert.equal(acquired.result.content[0].text.includes('"ownerSessionId": "session-a"'), true);

  const conflict = await context.handleMCPRequest({
    jsonrpc: "2.0",
    id: "select-b",
    _zenMcpSessionId: "session-b",
    method: "tools/call",
    params: { name: "zen_select_page", arguments: { pageIndex: 0 } },
  });
  assert.equal(conflict.result.isError, true);
  assert.match(conflict.result.content[0].text, /TAB_SWITCH_LOCK_CONFLICT/);
  assert.match(conflict.result.content[0].text, /session-a/);
});

test("session cleanup closes operated tabs and releases its lock", async () => {
  const context = loadBackground();
  const removed = [];
  context.browser.tabs.create = async () => ({ id: 99, windowId: 1, url: "https://created.example.com", title: "Created" });
  context.browser.tabs.query = async () => [
    { id: 1, windowId: 1, url: "about:blank", title: "Blank" },
    { id: 99, windowId: 1, url: "https://created.example.com", title: "Created" },
  ];
  context.browser.tabs.remove = async (tabIds) => removed.push(tabIds);

  await context.handleMCPRequest({
    jsonrpc: "2.0",
    id: "new",
    _zenMcpSessionId: "session-owned",
    method: "tools/call",
    params: { name: "zen_new_tab", arguments: {} },
  });
  await context.handleMCPRequest({ type: "zen/session-disconnected", sessionId: "session-owned" });
  await new Promise((resolve) => setTimeout(resolve, 0));

  assert.equal(JSON.stringify(removed), JSON.stringify([[99]]));
});
