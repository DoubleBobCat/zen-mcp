import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import test from "node:test";

const packageJson = JSON.parse(readFileSync("build/extension/package.json", "utf8"));
const read = (path) => readFileSync(path, "utf8");

function advertisedToolNames(background) {
  return [...background.matchAll(/toolMetadata\("(zen_[^"]+)"/g)].map((match) => match[1]);
}

test("active source directories match component boundaries", () => {
  assert.ok(existsSync("src/go-bridge"));
  assert.ok(existsSync("src/debug-frontend"));
  assert.ok(existsSync("src/extension"));
  assert.ok(existsSync("docs"));
  assert.ok(existsSync("tests"));
  assert.ok(existsSync("src/extension/lib/index.ts"));
  assert.ok(existsSync("src/extension/lib/tools/index.ts"));
  assert.ok(!existsSync("server"), "legacy root server directory should be removed");
});

test("repository root keeps only approved entries", () => {
  const approved = new Set([
    ".git",
    ".gitignore",
    "LICENSE",
    "AGENTS.md",
    "README.md",
    "README_zh.md",
    "build",
    ".github",
    ".gitea",
    "docs",
    "release",
    "scripts",
    "src",
    "tests",
  ]);
  assert.deepEqual(readdirSync(".").sort(), [...approved].sort());
});

test("documented npm scripts exist", () => {
  const docs = [read("README.md"), read("AGENTS.md"), read("docs/development/workflow.md")].join("\n");
  const scriptNames = [...docs.matchAll(/npm (?:--prefix build\/extension )?run ([a-z:.-]+)/g)].map((match) => match[1]);
  const uniqueScriptNames = [...new Set(scriptNames)];

  for (const scriptName of uniqueScriptNames) {
    assert.ok(
      packageJson.scripts?.[scriptName],
      `Documented script npm run ${scriptName} is missing from package.json`
    );
  }
});

test("build orchestration scripts remain compatible", () => {
  const requiredScripts = [
    "test",
    "typecheck",
    "build",
    "build:extension",
    "build:all",
    "server",
    "server:install",
    "bridge",
    "bridge:test",
    "bridge:build",
    "debug:build",
    "bridge:build:all",
    "ci:test",
    "ci:build",
    "ci:release",
  ];

  for (const scriptName of requiredScripts) {
    assert.ok(packageJson.scripts?.[scriptName], `Missing npm script ${scriptName}`);
  }

  assert.equal(
    packageJson.scripts["build:all"],
    "npm run bridge:build:all && npm run build:extension && npm run package"
  );
  assert.equal(packageJson.scripts.server, "npm run bridge");
  assert.match(packageJson.scripts["bridge:build"], /go build/);
  assert.match(packageJson.scripts["bridge:build:all"], /scripts\/build-release\.sh/);
  assert.match(packageJson.scripts["ci:test"], /scripts\/ci-test\.sh/);
  assert.match(packageJson.scripts["ci:build"], /scripts\/ci-build\.sh/);
  assert.match(packageJson.scripts["ci:release"], /scripts\/ci-release\.sh/);
  assert.equal(read("build/extension/.web-ext.yaml").match(/^source-dir: (.+)$/m)?.[1], "dist/extension");
});

test("repository metadata declares GPLv3 and bilingual readmes", () => {
  assert.match(read("LICENSE"), /GPL-3\.0-only/);
  assert.match(read("README.md"), /简体中文/);
  assert.match(read("README_zh.md"), /English/);
  assert.match(read("README.md"), /46 callable MCP tools/);
  assert.match(read("README_zh.md"), /46 个可调用 MCP 工具/);
});

test("root readmes link to language-matched markdown documents", () => {
  const englishLinks = [...read("README.md").split("\n").slice(3).join("\n").matchAll(/\[[^\]]+\]\(([^)#]+\.md)\)/g)].map(
    (match) => match[1]
  );
  const chineseLinks = [...read("README_zh.md").split("\n").slice(3).join("\n").matchAll(/\[[^\]]+\]\(([^)#]+\.md)\)/g)].map(
    (match) => match[1]
  );

  for (const relativePath of englishLinks) {
    assert.ok(existsSync(relativePath), `Missing English README target ${relativePath}`);
    assert.ok(
      existsSync(relativePath.replace(/\.md$/, "_zh.md")),
      `Missing Chinese counterpart for ${relativePath}`
    );
  }

  for (const relativePath of chineseLinks) {
    assert.ok(existsSync(relativePath), `Missing Chinese README target ${relativePath}`);
    assert.match(relativePath, /_zh\.md$/);
  }
});

test("documentation markdown files have language counterparts", () => {
  const markdownFiles = [];
  const visit = (directory) => {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const path = `${directory}/${entry.name}`;
      if (entry.isDirectory()) visit(path);
      else if (entry.name.endsWith(".md") && !entry.name.endsWith("_zh.md")) markdownFiles.push(path);
    }
  };
  visit("docs");

  for (const path of markdownFiles) {
    assert.ok(existsSync(path.replace(/\.md$/, "_zh.md")), `Missing Chinese counterpart for ${path}`);
  }
});

test("GitHub and Gitea workflows expose ordered CI and tag CD", () => {
  for (const workflowPath of [".github/workflows/ci.yml", ".gitea/workflows/ci.yml"]) {
    const workflow = read(workflowPath);
    assert.match(workflow, /name: CI and CD/);
    assert.match(workflow, /name: Test/);
    assert.match(workflow, /name: Build packages/);
    assert.match(workflow, /needs: test/);
    assert.match(workflow, /name: Publish/);
    assert.match(workflow, /startsWith\((?:github|gitea)\.ref, 'refs\/tags\/'\)/);
    assert.match(workflow, /ci:test/);
    assert.match(workflow, /ci:build/);
  }
});

test("server install invokes the generated user-service installer", () => {
  const serverInstall = packageJson.scripts?.["server:install"] ?? "";
  assert.match(serverInstall, /npm run build:all/);
  assert.match(serverInstall, /build\/go-bridge\/release\/install\.sh/);
});

test("bridge release packages a zip and restarts an existing service after updates", () => {
  const buildRelease = read("scripts/build-release.sh");
  const installer = read("release/install.sh");
  assert.match(buildRelease, /zen-mcp-bridge-linux-amd64\.tar\.gz/);
  assert.match(buildRelease, /zen-mcp-bridge-windows-amd64\.zip/);
  assert.match(buildRelease, /CGO_ENABLED=0/);
  assert.match(installer, /binary_updated=false/);
  assert.match(installer, /service_was_installed=false/);
  assert.match(installer, /cmp -s/);
  assert.match(installer, /systemctl --user restart zen-mcp-bridge\.service/);
  assert.match(installer, /systemctl --user enable --now zen-mcp-bridge\.service/);
});

test("tool documentation separates core diagnostics and unfinished tools", () => {
  const api = read("docs/api/all-tools.md");
  assert.match(api, /Stable core tools: 43/);
  assert.match(api, /Diagnostic tools: 3/);
  assert.match(api, /Unfinished documented tools/);
});

test("current architecture and development docs exist", () => {
  assert.ok(existsSync("docs/architecture/overview.md"));
  assert.ok(existsSync("docs/development/workflow.md"));
  assert.ok(existsSync("docs/Deployment.md"));
  assert.ok(existsSync("docs/Operation.md"));
});

test("documentation map and compatibility paths exist", () => {
  assert.ok(existsSync("docs/README.md"));
  assert.ok(existsSync("docs/api/all-tools.md"));
  assert.ok(existsSync("docs/api/workspace-tools.md"));
  assert.ok(existsSync("docs/api/openapi.yaml"));
  assert.ok(existsSync("docs/API/openapi.yaml"));
  assert.ok(existsSync("docs/specs/Plugin-Spec.md"));
  assert.ok(existsSync("docs/specs/MCP-Spec.md"));
  assert.ok(existsSync("docs/specs/Workflow-Spec.md"));
  assert.ok(existsSync("docs/specs/Event-Spec.md"));
  assert.ok(existsSync("docs/decisions/applicability.md"));
  assert.ok(!existsSync("docs/superpowers"));
  assert.ok(!existsSync("docs/archive"));
  assert.ok(!existsSync("docs/adr"));
  assert.ok(!existsSync("docs/validation-report.md"));
});

test("OpenAPI compatibility document stays synchronized", () => {
  assert.equal(read("docs/API/openapi.yaml"), read("docs/api/openapi.yaml"));
});

test("OpenAPI contract covers advertised extension tools", () => {
  const background = read("src/extension/background.js");
  const advertisedNames = advertisedToolNames(background);
  const openApi = read("docs/api/openapi.yaml");
  const documentedNames = [...openApi.matchAll(/^\s{6}name: (zen_[a-z_]+)$/gm)].map(
    (match) => match[1]
  );

  assert.ok(advertisedNames.length > 0, "No advertised tools found in extension background");
  assert.deepEqual(new Set(documentedNames), new Set(advertisedNames));
});

test("advertised extension tools map to snake_case tool handlers", () => {
  const background = read("src/extension/background.js");
  const advertisedNames = advertisedToolNames(background);
  const toolMapBody = background.match(/const toolMap = \{([\s\S]*?)\n\s*\};/)?.[1] ?? "";
  const toolMapKeys = new Set(
    [...toolMapBody.matchAll(/^\s*([a-z_]+):/gm)].map((match) => match[1])
  );

  assert.ok(advertisedNames.length > 0, "No advertised tools found in extension background");
  for (const name of advertisedNames) {
    const toolName = name.replace("zen_", "");
    assert.ok(toolMapKeys.has(toolName), `Missing toolMap handler for ${toolName}`);
  }
});

test("extension background loads bridge settings before connecting", () => {
  const background = read("src/extension/background.js");
  assert.match(background, /DEFAULT_BRIDGE_SETTINGS/);
  assert.match(background, /browser\.storage\.local\.get\("bridgeSettings"\)/);
  assert.match(background, /normalizeBridgeSettings/);
  assert.match(background, /bridgeConnection\.connect\(settings\)/);
  assert.match(background, /settings\.url/);
  assert.match(background, /settings\.reconnectInterval/);
  assert.match(background, /typeof settings\.autoConnect !== "boolean"/);
  assert.match(background, /autoConnect: settings\.autoConnect/);
});

test("extension background applies bridge settings changes immediately", () => {
  const background = read("src/extension/background.js");
  assert.match(background, /browser\.storage\.onChanged\.addListener/);
  assert.match(background, /areaName !== "local"/);
  assert.match(background, /changes\.bridgeSettings/);
  assert.match(background, /bridgeConnection\.stop\(\)/);
  assert.match(background, /setBridgeStatus\("disabled"\)/);
});

test("extension build script does not copy debug frontend into xpi source", () => {
  const buildExtension = packageJson.scripts?.["build:extension"] ?? "";
  assert.match(buildExtension, /rm -rf dist\/extension/);
  assert.doesNotMatch(buildExtension, /cp -r debug\b/);
  assert.doesNotMatch(buildExtension, /debug-frontend/);
});

test("extension packages bridge connection lifecycle script", () => {
  const manifest = JSON.parse(read("src/extension/manifest.json"));
   assert.deepEqual(manifest.background.scripts, ["index.js", "bridge-connection.js", "network-capture.js", "background.js"]);
  assert.match(packageJson.scripts?.["build:extension"] ?? "", /src\/extension\/bridge-connection\.js/);
   assert.match(packageJson.scripts?.["build:extension"] ?? "", /src\/extension\/content-script\.js/);
   assert.match(packageJson.scripts?.["build:extension"] ?? "", /src\/extension\/network-capture\.js/);
  assert.deepEqual(manifest.content_scripts?.[0]?.js, ["content-script.js"]);
});

test("settings page validates bridge settings before saving", () => {
  const settings = read("src/extension/settings/settings.js");
  assert.match(settings, /normalizeBridgeSettings/);
  assert.match(settings, /new URL\(/);
  assert.match(settings, /url\.protocol !== "ws:"/);
  assert.match(settings, /url\.protocol !== "wss:"/);
  assert.match(settings, /Number\.isFinite/);
  assert.match(settings, /reconnectInterval < 500/);
  assert.match(settings, /typeof settings\.autoConnect !== "boolean"/);
  assert.match(settings, /autoConnect: autoConnectInput\.checked/);
   assert.match(settings, /autoConnect: settings\.autoConnect/);
   assert.match(settings, /filterNetworkCookies/);
});
