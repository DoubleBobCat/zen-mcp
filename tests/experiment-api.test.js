import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const manifest = JSON.parse(readFileSync("src/extension/manifest.json", "utf8"));
const background = readFileSync("src/extension/background.js", "utf8");
const experimentApi = readFileSync("src/extension/experiment/api.js", "utf8");
const debugJs = readFileSync("src/debug-frontend/debug.js", "utf8");
const debugHtml = readFileSync("src/debug-frontend/index.html", "utf8");

test("manifest declares zenMcp privileged experiment API", () => {
  assert.equal(
    manifest.experiment_apis?.zenMcp?.schema,
    "experiment/schema.json"
  );
  assert.equal(
    manifest.experiment_apis?.zenMcp?.parent?.script,
    "experiment/api.js"
  );
  assert.deepEqual(manifest.experiment_apis?.zenMcp?.parent?.paths, [
    ["zenMcp"],
  ]);
});

test("manifest exposes bridge settings page", () => {
  assert.ok(manifest.permissions.includes("storage"));
  assert.equal(manifest.browser_action?.default_title, "zen-mcp bridge settings");
  assert.equal(manifest.browser_action?.default_popup, "settings/index.html");
  assert.equal(manifest.options_ui?.page, "settings/index.html");
  assert.equal(manifest.options_ui?.open_in_tab, false);
});

test("background routes workspace tools through privileged experiment", () => {
  assert.match(
    background,
    /Firefox Experiment API is not available; enable extensions\.experiments\.enabled/
  );
  assert.match(background, /return browser\.zenMcp/);
  assert.match(background, /getZenMcp\(\)\.listWorkspaces\(/);
  assert.match(background, /getZenMcp\(\)\.listWorkspaceTabs\(/);
  assert.match(background, /getZenMcp\(\)\.moveTabInWorkspace\(/);
  assert.match(background, /getZenMcp\(\)\.moveTabToWorkspace\(/);
  assert.match(background, /getZenMcp\(\)\.manageWorkspace\(/);
  assert.match(background, /listWorkspaceTabsWithBrowserIds\(/);
});

test("background routes folder and top pinned tab tools through privileged experiment", () => {
  assert.match(background, /getZenMcp\(\)\.listFolders\(/);
  assert.match(background, /getZenMcp\(\)\.manageFolder\(/);
  assert.match(background, /getZenMcp\(\)\.moveTabToFolder\(/);
  assert.match(background, /getZenMcp\(\)\.moveTabOutOfFolder\(/);
  assert.match(background, /getZenMcp\(\)\.listTopPinnedTabs\(/);
  assert.match(background, /getZenMcp\(\)\.manageTopPinnedTab\(/);
});

test("experiment schema declares folder and top pinned tab methods", () => {
  const schema = readFileSync("src/extension/experiment/schema.json", "utf8");
  for (const methodName of [
    "listFolders",
    "manageFolder",
    "moveTabToFolder",
    "moveTabOutOfFolder",
    "listTopPinnedTabs",
    "manageTopPinnedTab",
  ]) {
    assert.match(schema, new RegExp(`"name": "${methodName}"`));
  }
  assert.match(schema, /"enum": \["create", "rename", "delete", "unpack"\]/);
  assert.match(schema, /"enum": \["pin", "unpin", "move"\]/);
  assert.match(schema, /"name": "validateTabWorkspace"/);
});

test("experiment implementation classifies folders and top pinned tabs", () => {
  assert.match(experimentApi, /function requireZenFolders\(win\)/);
  assert.match(experimentApi, /function getFoldersForWorkspace\(win, workspaceId\)/);
  assert.match(experimentApi, /function getTopPinnedTabs\(win, workspaceId\)/);
  assert.match(experimentApi, /tab\.group\?\.isZenFolder/);
  assert.match(experimentApi, /tab\.hasAttribute\("zen-essential"\)/);
  assert.match(experimentApi, /tab\.hasAttribute\("zen-empty-tab"\)/);
  assert.match(experimentApi, /browsingContext\?\.browserId/);
  assert.match(experimentApi, /function getTabById\(win, tabId\)/);
});

test("background exposes an experiment diagnostics tool", () => {
  assert.match(background, /zen_diagnose_experiment/);
  assert.match(background, /diagnose_experiment: \(\) => diagnoseExperiment\(\)/);
  assert.match(background, /runtime\.getManifest\(\)/);
  assert.match(background, /zenMcpAvailable/);
});

test("experiment implementation uses Firefox ExtensionAPI base class", () => {
  assert.match(experimentApi, /this\.zenMcp = class extends ExtensionAPI/);
  assert.doesNotMatch(experimentApi, /ExtensionCommon\.ExtensionAPI/);
});

test("experiment exposes bounded temporary-file round trip for response decoding", () => {
  const schema = readFileSync("src/extension/experiment/schema.json", "utf8");
  assert.match(schema, /"name": "roundTripTempBase64"/);
  assert.match(experimentApi, /fileIO\.write\(path, bytes\)/);
  assert.match(experimentApi, /fileIO\.read\(path\)/);
  assert.match(experimentApi, /fileIO\.remove\(path, \{ ignoreAbsent: true \}\)/);
  assert.match(experimentApi, /finally/);
});

test("experiment listWorkspaces follows Zen workspace reference pattern", () => {
  assert.match(experimentApi, /Array\.from\(win\.gZenWorkspaces\.getWorkspaces\(\) \|\| \[\]\)/);
  assert.match(experimentApi, /const activeId = win\.gZenWorkspaces\.activeWorkspace/);
  assert.doesNotMatch(experimentApi, /getActiveWorkspace\(\)/);
});

test("experiment lists tabs from Zen stored tabs so inactive workspaces are included", () => {
  assert.match(experimentApi, /win\.gZenWorkspaces\.allStoredTabs/);
  assert.doesNotMatch(experimentApi, /for \(const tab of win\.gBrowser\.tabs\)/);
});

test("experiment exposes parent-side diagnostics", () => {
  assert.match(experimentApi, /async diagnosePing\(\)/);
  assert.match(experimentApi, /const servicesAvailable = typeof Services !== "undefined"/);
  assert.match(experimentApi, /async diagnoseParent\(\)/);
  assert.match(experimentApi, /gZenWorkspacesKeys/);
  assert.match(experimentApi, /listWorkspacesResult/);
  assert.match(experimentApi, /hasIOUtils/);
  assert.match(experimentApi, /hasPathUtils/);
});

test("debug console renders all tools from metadata with translations", () => {
  const toolIds = [...debugJs.matchAll(/tool\('([^']+)'/g)].map((match) => match[1]);

   assert.equal(toolIds.length, 46);
  assert.deepEqual(
    toolIds,
    [
      "navigate",
      "reload",
       "search",
      "list_pages",
      "select_page",
      "new_tab",
      "close_tab",
      "snapshot",
      "screenshot",
      "get_page_text",
      "get_form_fields",
      "click",
      "fill",
      "select_option",
      "check",
      "press_key",
      "fill_form",
      "scroll",
      "evaluate",
      "wait",
      "wait_for",
      "reconnect",
      "list_workspaces",
      "list_workspace_tabs",
      "move_tab_in_workspace",
      "move_tab_to_workspace",
      "manage_workspace",
      "list_folders",
      "manage_folder",
      "move_tab_to_folder",
      "move_tab_out_of_folder",
      "list_top_pinned_tabs",
      "manage_top_pinned_tab",
      "acquire_tab_switch_lock",
      "release_tab_switch_lock",
      "get_tab_switch_lock",
      "network_start",
      "network_stop",
      "network_list",
      "network_get_request",
      "network_get_response",
      "network_replay",
      "network_replay_with_response",
      "diagnose_experiment",
      "diagnose_parent",
      "diagnose_ping",
    ]
  );
  assert.match(debugJs, /const I18N = \{/);
  assert.match(debugJs, /'zh-CN'/);
  assert.match(debugJs, /\ben:/);
  assert.match(debugJs, /function setLanguage\(lang\)/);
  assert.match(debugHtml, /id="categoryFilters"/);
  assert.match(debugHtml, /id="languageSelect"/);
  assert.match(debugHtml, /id="toolsGrid"/);
});

test("debug console exports every list result as RFC-style CSV and targets real page ids", () => {
  assert.match(debugJs, /const LIST_EXPORTS = \{/);
  for (const toolName of [
    "list_pages",
    "list_workspaces",
    "list_workspace_tabs",
    "list_folders",
    "list_top_pinned_tabs",
    "get_form_fields",
  ]) {
    assert.match(debugJs, new RegExp(`${toolName}: ['\"](?:pages|workspaces|tabs|folders|fields)['\"]`));
  }
  assert.match(debugJs, /function createListCsv\(data, itemsKey\)/);
  assert.match(debugJs, /function flattenCsvValue\(value, prefix = '', output = \{\}\)/);
  assert.match(debugJs, /replace\(\/"\/g, '\"\"'\)/);
  assert.match(debugJs, /field\('tabId', 'page', \{ required: true \}\)/);
  assert.match(debugJs, /field\('workspaceId', 'workspace', \{ optional: true \}\)/);
  assert.match(debugJs, /field\('expectedUrl', 'text', \{ optional: true/);
  assert.match(debugJs, /function populatePageSelects\(pages\)/);
  assert.match(debugJs, /id="export-\$\{toolMeta\.id\}"/);
  assert.match(debugJs, /if \(!raw && item\.required\)/);
});

test("extension background owns browser tool execution without relying on bundled page globals", () => {
  assert.match(background, /async function listBrowserPages\(\)/);
  assert.match(background, /async function callPageTool\(toolName, args = \{\}, context = \{\}\)/);
  assert.match(background, /function pageToolRunner\(toolName, args\)/);
  assert.match(background, /navigate: \(\) => navigatePage\(args\?\.url, args, context\)/);
  assert.match(background, /list_pages: \(\) => listBrowserPages\(\)/);
  assert.match(background, /snapshot: \(\) => callPageTool\("snapshot", args, context\)/);
  assert.doesNotMatch(background, /ZenMCP\./);
  assert.match(background, /browser\.tabs\.executeScript\(tab\.id/);
  assert.match(background, /browser\.tabs\.sendMessage\(tab\.id/);
  assert.match(background, /browser\.tabs\.captureVisibleTab\(tab\.windowId/);
  assert.match(background, /executionMode: "selected-tab-fallback"/);
});
