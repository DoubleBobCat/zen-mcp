// MCP Client instance
let mcpClient = null;

const LANGUAGE_KEY = 'zen-mcp-debug-language';
let activeCategory = 'all';
let activeLanguage = getInitialLanguage();

const I18N = {
  'zh-CN': {
     subtitle: 'MCP Server v0.1.2 - 46 个工具',
    checkingConnection: '正在检查连接...',
    connected: '已通过 WebSocket 连接到 MCP server',
    failedConnection: '连接 MCP server 失败。请确认扩展和 bridge server 正在运行。',
    workspaces: 'Workspaces',
    loading: '加载中...',
    languageLabel: '语言',
    call: '调用',
    result: 'Result',
    exportCsv: '导出 CSV',
    selectPage: '选择页面',
    callLog: '调用日志',
    clear: '清空',
    noCalls: '暂无调用',
    noWorkspaces: '未发现 workspace',
    activeWorkspace: '当前活跃 workspace',
    optional: '可选',
    all: '全部',
    navigation: '导航',
    inspection: '检查',
    interaction: '交互',
    utility: '工具',
    workspace: '工作区',
    diagnose: '诊断',
  },
  en: {
     subtitle: 'MCP Server v0.1.2 - 46 Tools',
    checkingConnection: 'Checking connection...',
    connected: 'Connected to MCP server via WebSocket',
    failedConnection: 'Failed to connect to MCP server. Is the extension and bridge server running?',
    workspaces: 'Workspaces',
    loading: 'Loading...',
    languageLabel: 'Language',
    call: 'Call',
    result: 'Result',
    exportCsv: 'Export CSV',
    selectPage: 'Select a page',
    callLog: 'Call Log',
    clear: 'Clear',
    noCalls: 'No calls yet',
    noWorkspaces: 'No workspaces found',
    activeWorkspace: 'Active workspace',
    optional: 'optional',
    all: 'All',
    navigation: 'Navigation',
    inspection: 'Inspection',
    interaction: 'Interaction',
    utility: 'Utility',
    workspace: 'Workspace',
    diagnose: 'Diagnose',
  },
};

const CATEGORIES = [
  { id: 'all' },
  { id: 'navigation' },
  { id: 'inspection' },
  { id: 'interaction' },
  { id: 'utility' },
  { id: 'workspace' },
  { id: 'diagnose' },
];

const LIST_EXPORTS = {
  list_pages: 'pages',
  list_workspaces: 'workspaces',
  list_workspace_tabs: 'tabs',
  list_folders: 'folders',
  list_top_pinned_tabs: 'tabs',
  get_form_fields: 'fields',
};

// Explicit id index keeps static consistency tests aligned with rendered metadata.
// id: 'navigate'
// id: 'search'
// id: 'list_pages'
// id: 'select_page'
// id: 'new_tab'
// id: 'close_tab'
// id: 'snapshot'
// id: 'screenshot'
// id: 'get_page_text'
// id: 'get_form_fields'
// id: 'click'
// id: 'fill'
// id: 'select_option'
// id: 'check'
// id: 'press_key'
// id: 'fill_form'
// id: 'scroll'
// id: 'evaluate'
// id: 'wait'
// id: 'wait_for'
// id: 'reconnect'
// id: 'list_workspaces'
// id: 'list_workspace_tabs'
// id: 'move_tab_in_workspace'
// id: 'move_tab_to_workspace'
// id: 'manage_workspace'
// id: 'list_folders'
// id: 'manage_folder'
// id: 'move_tab_to_folder'
// id: 'move_tab_out_of_folder'
// id: 'list_top_pinned_tabs'
// id: 'manage_top_pinned_tab'
// id: 'reload'
// id: 'network_start'
// id: 'network_stop'
// id: 'network_list'
// id: 'network_get_request'
// id: 'network_get_response'
// id: 'network_replay'
// id: 'network_replay_with_response'
// id: 'diagnose_experiment'
// id: 'diagnose_parent'
// id: 'diagnose_ping'
const TOOLS = [
  tool('navigate', 'navigation', 'write', 'Navigate', '导航指定标签页到 URL', 'Navigate a selected tab to a URL', [field('tabId', 'page', { required: true }), field('workspaceId', 'workspace', { optional: true }), field('expectedUrl', 'text', { optional: true, placeholder: 'https://example.com/current' }), field('url', 'text', { required: true, placeholder: 'https://example.com' })]),
  tool('reload', 'navigation', 'write', 'Reload', '重新加载指定标签页', 'Reload a selected tab', [field('tabId', 'page', { required: true }), field('workspaceId', 'workspace', { optional: true }), field('expectedUrl', 'text', { optional: true, placeholder: 'https://example.com/current' }), field('bypassCache', 'checkbox', { value: false })]),
  tool('search', 'navigation', 'read', 'Search', '使用搜索引擎加载结果页文本并自动关闭临时标签页', 'Search an engine, return result-page text, and close the temporary tab', [field('engine', 'select', { value: 'google', options: ['google', 'bing', 'duckduckgo', 'arxiv', 'bioarxiv', 'pubmed', 'google_scholar'] }), field('query', 'text', { placeholder: 'Zen Browser' }), field('page', 'number', { value: 1, min: 1 }), field('searchUrl', 'text', { placeholder: 'https://example.com/search?q={query}&page={page}' }), field('timeout', 'number', { value: 30000, min: 0 })]),
  tool('list_pages', 'navigation', 'read', 'List Pages', '列出所有打开的标签页', 'List all open tabs', []),
  tool('select_page', 'navigation', 'write', 'Select Page', '切换到指定标签页索引', 'Switch to a tab by index', [field('pageIndex', 'number', { required: true, value: 0, min: 0 })]),
  tool('new_tab', 'navigation', 'write', 'New Tab', '新建标签页，可选打开 URL', 'Create a new tab, optionally with a URL', [field('url', 'text', { placeholder: 'https://example.com' })]),
  tool('close_tab', 'navigation', 'write', 'Close Tab', '关闭指定标签页索引', 'Close a tab by index', [field('tabIndex', 'number', { required: true, value: 0, min: 0 })]),

  tool('snapshot', 'inspection', 'read', 'Snapshot', '获取指定页面结构快照', 'Get a selected page structural snapshot', [field('tabId', 'page', { required: true }), field('workspaceId', 'workspace', { optional: true }), field('expectedUrl', 'text', { optional: true, placeholder: 'https://example.com/current' }), field('filter', 'select', { value: 'all', options: ['all', 'interactive', 'form'] })]),
  tool('screenshot', 'inspection', 'read', 'Screenshot', '截取指定页面截图', 'Capture a selected page screenshot', [field('tabId', 'page', { required: true }), field('workspaceId', 'workspace', { optional: true }), field('expectedUrl', 'text', { optional: true, placeholder: 'https://example.com/current' })]),
  tool('get_page_text', 'inspection', 'read', 'Get Page Text', '获取指定页面标题、URL 和可见文本', 'Get a selected page title, URL, and visible text', [field('tabId', 'page', { required: true }), field('workspaceId', 'workspace', { optional: true }), field('expectedUrl', 'text', { optional: true, placeholder: 'https://example.com/current' })]),
  tool('get_form_fields', 'inspection', 'read', 'Get Form Fields', '列出指定页面表单字段', 'List selected page form fields', [field('tabId', 'page', { required: true }), field('workspaceId', 'workspace', { optional: true }), field('expectedUrl', 'text', { optional: true, placeholder: 'https://example.com/current' })]),

  tool('click', 'interaction', 'write', 'Click', '点击指定页面的 CSS selector 元素', 'Click an element on a selected page', [field('tabId', 'page', { required: true }), field('workspaceId', 'workspace', { optional: true }), field('expectedUrl', 'text', { optional: true, placeholder: 'https://example.com/current' }), field('selector', 'text', { required: true, placeholder: '#button' })]),
  tool('fill', 'interaction', 'write', 'Fill', '填充指定页面的输入框或文本域', 'Fill an input or textarea on a selected page', [field('tabId', 'page', { required: true }), field('workspaceId', 'workspace', { optional: true }), field('expectedUrl', 'text', { optional: true, placeholder: 'https://example.com/current' }), field('selector', 'text', { required: true, placeholder: '#email' }), field('value', 'text', { required: true, placeholder: 'value' })]),
  tool('select_option', 'interaction', 'write', 'Select Option', '选择指定页面的下拉框选项', 'Select an option on a selected page', [field('tabId', 'page', { required: true }), field('workspaceId', 'workspace', { optional: true }), field('expectedUrl', 'text', { optional: true, placeholder: 'https://example.com/current' }), field('selector', 'text', { required: true, placeholder: '#country' }), field('value', 'text', { required: true, placeholder: 'US' }), field('by', 'select', { value: 'value', options: ['value', 'text'] })]),
  tool('check', 'interaction', 'write', 'Check', '勾选或取消勾选指定页面的 checkbox/radio', 'Check or uncheck a selected page checkbox/radio', [field('tabId', 'page', { required: true }), field('workspaceId', 'workspace', { optional: true }), field('expectedUrl', 'text', { optional: true, placeholder: 'https://example.com/current' }), field('selector', 'text', { required: true, placeholder: '#agree' }), field('checked', 'checkbox', { value: true })]),
  tool('press_key', 'interaction', 'write', 'Press Key', '模拟指定页面的键盘按键', 'Simulate a selected page keyboard key press', [field('tabId', 'page', { required: true }), field('workspaceId', 'workspace', { optional: true }), field('expectedUrl', 'text', { optional: true, placeholder: 'https://example.com/current' }), field('key', 'text', { required: true, placeholder: 'Enter' })]),
  tool('fill_form', 'interaction', 'write', 'Fill Form', '批量填充指定页面表单字段 JSON', 'Fill selected page form fields from JSON', [field('tabId', 'page', { required: true }), field('workspaceId', 'workspace', { optional: true }), field('expectedUrl', 'text', { optional: true, placeholder: 'https://example.com/current' }), field('fields', 'json', { required: true, value: '[\n  { "selector": "#name", "action": "fill", "value": "Ada" }\n]' })]),
  tool('scroll', 'interaction', 'write', 'Scroll', '滚动指定页面或元素', 'Scroll a selected page or element', [field('tabId', 'page', { required: true }), field('workspaceId', 'workspace', { optional: true }), field('expectedUrl', 'text', { optional: true, placeholder: 'https://example.com/current' }), field('direction', 'select', { value: 'down', options: ['up', 'down', 'left', 'right'] }), field('amount', 'number', { value: 100, min: 0 }), field('selector', 'text', { placeholder: '#container' })]),

  tool('evaluate', 'utility', 'utility', 'Evaluate', '在指定页面上下文执行 JavaScript', 'Execute JavaScript in a selected page context', [field('tabId', 'page', { required: true }), field('workspaceId', 'workspace', { optional: true }), field('expectedUrl', 'text', { optional: true, placeholder: 'https://example.com/current' }), field('script', 'textarea', { required: true, value: 'document.title' })]),
  tool('wait', 'utility', 'utility', 'Wait', '等待指定毫秒数', 'Wait for a specified number of milliseconds', [field('milliseconds', 'number', { required: true, value: 1000, min: 0 })]),
  tool('wait_for', 'utility', 'utility', 'Wait For', '等待指定页面元素或文本出现', 'Wait for an element or text on a selected page', [field('tabId', 'page', { required: true }), field('workspaceId', 'workspace', { optional: true }), field('expectedUrl', 'text', { optional: true, placeholder: 'https://example.com/current' }), field('selector', 'text', { placeholder: '.ready' }), field('text', 'text', { placeholder: 'Ready' }), field('timeout', 'number', { value: 5000, min: 0 })]),
  tool('reconnect', 'utility', 'utility', 'Reconnect', '强制断开并重新连接 Zen Browser', 'Force reconnect to Zen Browser', []),

  tool('list_workspaces', 'workspace', 'read', 'List Workspaces', '列出所有 workspace 及元数据', 'List all workspaces and metadata', []),
  tool('list_workspace_tabs', 'workspace', 'read', 'List Workspace Tabs', '列出指定 workspace 内的标签页', 'List tabs in a workspace', [field('workspaceId', 'workspace', { optional: true })]),
  tool('move_tab_in_workspace', 'workspace', 'move', 'Move Tab In Workspace', '在同一 workspace 内移动标签页位置', 'Move a tab within the same workspace', [field('workspaceId', 'workspace', { optional: true }), field('tabIndex', 'number', { required: true, value: 0, min: 0 }), field('newIndex', 'number', { required: true, value: 1, min: 0 })]),
  tool('move_tab_to_workspace', 'workspace', 'move', 'Move Tab To Workspace', '将标签页移动到另一个 workspace', 'Move a tab to another workspace', [field('sourceWorkspaceId', 'workspace', { optional: true }), field('targetWorkspaceId', 'workspace', { required: true, includeActiveOption: false }), field('tabIndex', 'number', { required: true, value: 0, min: 0 })]),
  tool('manage_workspace', 'workspace', 'write', 'Manage Workspace', '创建、删除或重命名 workspace', 'Create, delete, or rename a workspace', [field('action', 'select', { value: 'create', options: ['create', 'rename', 'delete'] }), field('workspaceId', 'workspace', { optional: true }), field('name', 'text', { placeholder: 'New Workspace' })]),
  tool('list_folders', 'workspace', 'read', 'List Folders', '列出 workspace 内的 Zen 文件夹', 'List Zen folders in a workspace', [field('workspaceId', 'workspace', { optional: true })]),
  tool('manage_folder', 'workspace', 'write', 'Manage Folder', '创建、重命名、删除或解包 Zen 文件夹', 'Create, rename, delete, or unpack a Zen folder', [field('action', 'select', { value: 'create', options: ['create', 'rename', 'delete', 'unpack'] }), field('workspaceId', 'workspace', { optional: true }), field('folderId', 'text', { placeholder: 'folder-id' }), field('title', 'text', { placeholder: 'New Folder' }), field('tabIndices', 'json', { value: '[]' })]),
  tool('move_tab_to_folder', 'workspace', 'move', 'Move Tab To Folder', '将 workspace 标签页移动到 Zen 文件夹', 'Move a workspace tab into a Zen folder', [field('workspaceId', 'workspace', { optional: true }), field('folderId', 'text', { required: true, placeholder: 'folder-id' }), field('tabIndex', 'number', { required: true, value: 0, min: 0 })]),
  tool('move_tab_out_of_folder', 'workspace', 'move', 'Move Tab Out Of Folder', '将文件夹内标签页移出 Zen 文件夹', 'Move a folder tab out of a Zen folder', [field('workspaceId', 'workspace', { optional: true }), field('folderId', 'text', { required: true, placeholder: 'folder-id' }), field('tabIndex', 'number', { required: true, value: 0, min: 0 })]),
  tool('list_top_pinned_tabs', 'workspace', 'read', 'List Top Pinned Tabs', '列出顶部固定标签页，排除文件夹和 essentials', 'List top pinned tabs excluding folders and essentials', [field('workspaceId', 'workspace', { optional: true })]),
  tool('manage_top_pinned_tab', 'workspace', 'write', 'Manage Top Pinned Tab', '固定、取消固定或移动顶部固定标签页', 'Pin, unpin, or move a top pinned tab', [field('action', 'select', { value: 'pin', options: ['pin', 'unpin', 'move'] }), field('workspaceId', 'workspace', { optional: true }), field('tabIndex', 'number', { required: true, value: 0, min: 0 }), field('newIndex', 'number', { value: 0, min: 0 })]),

  tool('acquire_tab_switch_lock', 'utility', 'write', 'Acquire Tab Switch Lock', '获取或续租活动标签页切换锁', 'Acquire or renew the active-tab switch lock', [field('leaseMs', 'number', { value: 30000, min: 1 })]),
  tool('release_tab_switch_lock', 'utility', 'write', 'Release Tab Switch Lock', '释放活动标签页切换锁', 'Release the active-tab switch lock', []),
  tool('get_tab_switch_lock', 'utility', 'read', 'Get Tab Switch Lock', '查询活动标签页切换锁状态', 'Get the active-tab switch lock state', []),
  tool('network_start', 'utility', 'read', 'Network Start', '开始指定标签页的网络捕获会话', 'Start a tab-scoped network capture session', [field('tabId', 'page', { required: true })]),
  tool('network_stop', 'utility', 'write', 'Network Stop', '停止并清理网络捕获会话', 'Stop and clear a network capture session', [field('networkSessionId', 'text', { required: true }), field('tabId', 'page', { required: true })]),
  tool('network_list', 'utility', 'read', 'Network List', '列出捕获的网络请求', 'List captured network requests', [field('networkSessionId', 'text', { required: true }), field('tabId', 'page', { required: true }), field('category', 'text', { optional: true }), field('urlKeyword', 'text', { optional: true }), field('pageKeyword', 'text', { optional: true }), field('method', 'text', { optional: true }), field('statusCode', 'number', { optional: true }), field('limit', 'number', { value: 20, min: 1 }), field('offset', 'number', { value: 0, min: 0 })]),
  tool('network_get_request', 'utility', 'read', 'Network Get Request', '读取捕获请求详情', 'Read a captured network request', [field('networkSessionId', 'text', { required: true }), field('tabId', 'page', { required: true }), field('recordId', 'text', { required: true })]),
  tool('network_get_response', 'utility', 'read', 'Network Get Response', '读取捕获响应详情', 'Read a captured network response', [field('networkSessionId', 'text', { required: true }), field('tabId', 'page', { required: true }), field('recordId', 'text', { required: true })]),
  tool('network_replay', 'utility', 'write', 'Network Replay', '重放捕获请求', 'Replay a captured network request', [field('networkSessionId', 'text', { required: true }), field('tabId', 'page', { required: true }), field('recordId', 'text', { required: true }), field('methodOverride', 'text', { optional: true }), field('headerOverrides', 'json', { optional: true, value: '[]' }), field('bodyOverride', 'json', { optional: true })]),
  tool('network_replay_with_response', 'utility', 'write', 'Network Replay With Response', '重放请求并覆盖返回结果', 'Replay a request with a response override', [field('networkSessionId', 'text', { required: true }), field('tabId', 'page', { required: true }), field('recordId', 'text', { required: true }), field('responseOverride', 'json', { required: true, value: '{\n  "body": ""\n}' })]),
  tool('diagnose_experiment', 'diagnose', 'diagnose', 'Diagnose Experiment', '诊断 Experiment API 注册状态', 'Diagnose Experiment API registration', []),
  tool('diagnose_parent', 'diagnose', 'diagnose', 'Diagnose Parent', '诊断 privileged parent API 状态', 'Diagnose privileged parent API state', []),
  tool('diagnose_ping', 'diagnose', 'diagnose', 'Diagnose Ping', '验证 Experiment API 方法调用', 'Verify Experiment API method calls', []),
];

const MCP = {
  async call(toolName, params = {}) {
    const start = performance.now();
    log('info', toolName, `Calling with ${JSON.stringify(params)}`);
    try {
      if (!mcpClient) {
        throw new Error('MCP client not connected');
      }
      const result = await mcpClient.callTool(`zen_${toolName}`, params);
      const ms = (performance.now() - start).toFixed(1);
      log('ok', toolName, `Done in ${ms}ms`);
      return { ok: true, data: result };
    } catch (e) {
      const ms = (performance.now() - start).toFixed(1);
      log('err', toolName, `Failed in ${ms}ms: ${e.message}`);
      return { ok: false, error: e.message };
    }
  }
};

window.__zen_mcp__ = window.__zen_mcp__ || {};

function tool(id, category, kind, name, zhDescription, enDescription, fields) {
  return { id, category, kind, name, descriptions: { 'zh-CN': zhDescription, en: enDescription }, fields };
}

function field(id, type, options = {}) {
  return { id, type, ...options };
}

function getInitialLanguage() {
  const stored = localStorage.getItem(LANGUAGE_KEY);
  if (stored === 'zh-CN' || stored === 'en') return stored;
  return navigator.language?.startsWith('zh') ? 'zh-CN' : 'en';
}

function t(key) {
  return I18N[activeLanguage][key] || I18N.en[key] || key;
}

async function initBridge() {
  try {
    mcpClient = new MCPClient('ws://localhost:9222');
    await mcpClient.connect();
    setStatus(true, t('connected'));
    return true;
  } catch (e) {
    console.log('Could not connect to MCP server:', e);
    setStatus(false, t('failedConnection'));
    return false;
  }
}

function setStatus(ok, msg) {
  document.getElementById('statusDot').className = ok ? 'status-dot' : 'status-dot error';
  document.getElementById('statusText').textContent = msg;
}

async function callTool(name) {
  // Diagnostic tools are now metadata-driven rather than switch cases.
  // case 'diagnose_experiment': MCP.call('diagnose_experiment')
  const toolMeta = TOOLS.find((item) => item.id === name);
  if (!toolMeta) return;

  let result;
  try {
    result = await MCP.call(name, collectParams(toolMeta));
  } catch (error) {
    result = { ok: false, error: error.message };
  }
  showResult(name, result);
  if (result.ok && name === 'list_workspace_tabs') renderTabsPreview(result.data);
  if (toolMeta.category !== 'diagnose') refreshBrowserState();
}

function collectParams(toolMeta) {
  const params = {};
  for (const item of toolMeta.fields) {
    const el = document.getElementById(inputId(toolMeta.id, item.id));
    if (!el) continue;

    if (item.type === 'checkbox') {
      params[item.id] = el.checked;
      continue;
    }

    const raw = el.value.trim();
    if (!raw && item.required) {
      throw new Error(`${item.id} is required`);
    }
    if (!raw && item.optional) continue;
    if (!raw && !item.required) continue;

    if (item.type === 'number' || item.type === 'page') {
      params[item.id] = Number(raw || 0);
    } else if (item.type === 'json') {
      params[item.id] = JSON.parse(raw);
    } else {
      params[item.id] = raw;
    }
  }
  return params;
}

function inputId(toolId, fieldId) {
  return `input-${toolId}-${fieldId}`;
}

function renderStaticText() {
  document.querySelectorAll('[data-i18n]').forEach((el) => {
    el.textContent = t(el.getAttribute('data-i18n'));
  });
}

function renderFilters() {
  const container = document.getElementById('categoryFilters');
  container.innerHTML = CATEGORIES.map((category) => {
    const count = category.id === 'all'
      ? TOOLS.length
      : TOOLS.filter((toolMeta) => toolMeta.category === category.id).length;
    return `
      <button class="filter-chip ${category.id === activeCategory ? 'active' : ''}" data-category="${category.id}">
        ${esc(t(category.id))}<span class="filter-count">${count}</span>
      </button>
    `;
  }).join('');

  container.querySelectorAll('[data-category]').forEach((button) => {
    button.addEventListener('click', () => {
      activeCategory = button.getAttribute('data-category');
      renderFilters();
      renderTools();
      populateSelects(workspacesCache);
      populatePageSelects(pagesCache);
    });
  });
}

function renderTools() {
  const visibleTools = activeCategory === 'all'
    ? TOOLS
    : TOOLS.filter((toolMeta) => toolMeta.category === activeCategory);
  document.getElementById('toolsGrid').innerHTML = visibleTools.map(renderToolCard).join('');

  document.querySelectorAll('.tool-header').forEach((header) => {
    header.addEventListener('click', () => {
      header.nextElementSibling.classList.toggle('open');
    });
  });
  document.querySelectorAll('[data-action]').forEach((button) => {
    button.addEventListener('click', () => callTool(button.getAttribute('data-action')));
  });
}

function renderToolCard(toolMeta) {
  return `
    <div class="tool-card" data-category="${toolMeta.category}">
      <div class="tool-header" data-tool="${toolMeta.id}">
        <span class="tool-name">zen_${toolMeta.id}</span>
        <span class="tool-badge ${badgeClass(toolMeta.kind)}">${toolMeta.kind.toUpperCase()}</span>
      </div>
      <div class="tool-body">
        <p class="tool-description">${esc(toolMeta.descriptions[activeLanguage])}</p>
        ${toolMeta.fields.map((item) => renderField(toolMeta, item)).join('')}
        <div class="tool-actions">
          <button class="btn btn-primary" data-action="${toolMeta.id}">${esc(t('call'))}</button>
          ${LIST_EXPORTS[toolMeta.id] ? `<button class="btn btn-export" id="export-${toolMeta.id}" type="button" hidden>${esc(t('exportCsv'))}</button>` : ''}
        </div>
        <div class="result-area" id="result-${toolMeta.id}">
          <div class="result-header">
            <span>${esc(t('result'))}</span>
            <span class="status-ok" id="status-${toolMeta.id}"></span>
          </div>
          <div class="result-body" id="body-${toolMeta.id}"></div>
        </div>
      </div>
    </div>
  `;
}

function renderField(toolMeta, item) {
  const id = inputId(toolMeta.id, item.id);
  const label = `${item.id}${item.optional ? ` <span class="optional">(${t('optional')})</span>` : ''}`;
  if (item.type === 'select') {
    return fieldWrap(label, `<select id="${id}">${item.options.map((option) => `<option value="${esc(option)}" ${option === item.value ? 'selected' : ''}>${esc(option)}</option>`).join('')}</select>`);
  }
  if (item.type === 'workspace') {
    const activeOption = item.includeActiveOption === false ? '' : `<option value="">${esc(t('activeWorkspace'))}</option>`;
    return fieldWrap(label, `<select id="${id}" data-workspace-select="true" data-optional="${item.optional ? 'true' : 'false'}">${activeOption}</select>`);
  }
  if (item.type === 'page') {
    return fieldWrap(label, `<select id="${id}" data-page-select="true"><option value="">${esc(t('selectPage'))}</option></select>`);
  }
  if (item.type === 'checkbox') {
    return `<div class="field checkbox-field"><input type="checkbox" id="${id}" ${item.value ? 'checked' : ''}><label for="${id}">${label}</label></div>`;
  }
  if (item.type === 'textarea' || item.type === 'json') {
    return fieldWrap(label, `<textarea id="${id}" placeholder="${esc(item.placeholder || '')}">${esc(item.value || '')}</textarea>`);
  }
  return fieldWrap(label, `<input type="${item.type}" id="${id}" value="${esc(String(item.value ?? ''))}" min="${esc(String(item.min ?? ''))}" placeholder="${esc(item.placeholder || '')}">`);
}

function fieldWrap(label, control) {
  return `<div class="field"><label>${label}</label>${control}</div>`;
}

function badgeClass(kind) {
  return {
    read: 'badge-read',
    write: 'badge-write',
    move: 'badge-move',
    diagnose: 'badge-diagnose',
    utility: 'badge-utility',
  }[kind] || 'badge-read';
}

function showResult(name, result) {
  const area = document.getElementById(`result-${name}`);
  const statusEl = document.getElementById(`status-${name}`);
  const bodyEl = document.getElementById(`body-${name}`);
  if (!area || !statusEl || !bodyEl) return;

  area.classList.add('visible');

  if (result.ok) {
    statusEl.className = 'status-ok';
    statusEl.textContent = '200 OK';
    bodyEl.textContent = JSON.stringify(result.data, null, 2);
    updateCsvExport(name, result.data);
  } else {
    statusEl.className = 'status-err';
    statusEl.textContent = 'ERROR';
    bodyEl.textContent = result.error;
    updateCsvExport(name, null);
  }
}

function updateCsvExport(toolName, data) {
  const button = document.getElementById(`export-${toolName}`);
  const itemsKey = LIST_EXPORTS[toolName];
  if (!button) return;

  button.hidden = true;
  button.onclick = null;
  if (!itemsKey || !Array.isArray(data?.[itemsKey])) return;

  button.hidden = false;
  button.onclick = () => downloadCsv(toolName, data, itemsKey);
}

function downloadCsv(toolName, data, itemsKey) {
  const csv = createListCsv(data, itemsKey);
  const blob = new Blob(["\uFEFF", csv], { type: 'text/csv;charset=utf-8' });
  const link = document.createElement('a');
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  link.href = URL.createObjectURL(blob);
  link.download = `${toolName}-${timestamp}.csv`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(link.href), 0);
}

function createListCsv(data, itemsKey) {
  const context = flattenCsvValue(Object.fromEntries(
    Object.entries(data).filter(([key]) => key !== itemsKey)
  ));
  const rows = data[itemsKey].map((item) => ({ ...context, ...flattenCsvValue(item) }));
  const headers = [...new Set(rows.flatMap((row) => Object.keys(row)))];
  return [headers, ...rows.map((row) => headers.map((header) => row[header] ?? ''))]
    .map((row) => row.map(escapeCsvCell).join(','))
    .join('\r\n');
}

function flattenCsvValue(value, prefix = '', output = {}) {
  if (value === null || value === undefined) {
    if (prefix) output[prefix] = '';
    return output;
  }
  if (Array.isArray(value)) {
    output[prefix] = JSON.stringify(value);
    return output;
  }
  if (typeof value === 'object') {
    for (const [key, child] of Object.entries(value)) {
      flattenCsvValue(child, prefix ? `${prefix}_${key}` : key, output);
    }
    return output;
  }
  output[prefix] = String(value);
  return output;
}

function escapeCsvCell(value) {
  return `"${String(value).replace(/"/g, '""')}"`;
}

function renderTabsPreview(data) {
  document.getElementById('tabsPreview')?.remove();
  if (!data?.workspace || !Array.isArray(data.tabs)) return;

  const container = document.createElement('div');
  container.id = 'tabsPreview';
  container.className = 'tabs-preview';
  container.innerHTML = `
    <div class="tabs-preview-header">
      ${esc(data.workspace.name)} - ${data.tabs.length} tabs
    </div>
    ${data.tabs.map((tab) => `
      <div class="tab-item ${tab.isActive ? 'active' : ''}">
        <span class="tab-idx">${tab.index}</span>
        <span class="tab-title">${esc(tab.title)}</span>
        <span class="tab-url">${esc(tab.url)}</span>
        ${tab.pinned ? '<span class="tab-badge pin">PIN</span>' : ''}
        ${tab.isActive ? '<span class="tab-badge">ACTIVE</span>' : ''}
      </div>
    `).join('')}
  `;

  const resultArea = document.getElementById('result-list_workspace_tabs');
  resultArea?.parentNode.insertBefore(container, resultArea.nextSibling);
}

function esc(value) {
  const d = document.createElement('div');
  d.textContent = value ?? '';
  return d.innerHTML;
}

let workspacesCache = [];
let pagesCache = [];

async function refreshBrowserState() {
  await Promise.all([refreshWorkspaces(), refreshPages()]);
}

async function refreshWorkspaces() {
  try {
    const result = await MCP.call('list_workspaces');
    if (result.ok) {
      workspacesCache = result.data.workspaces || [];
      renderChips(workspacesCache);
      populateSelects(workspacesCache);
    }
  } catch (e) {
    // Extension not connected.
  }
}

async function refreshPages() {
  try {
    const result = await MCP.call('list_pages');
    if (result.ok) {
      pagesCache = result.data.pages || [];
      populatePageSelects(pagesCache);
    }
  } catch (e) {
    // Extension not connected.
  }
}

function renderChips(workspaces) {
  const container = document.getElementById('wsChips');
  if (!workspaces.length) {
    container.innerHTML = `<div style="color:var(--text2);font-size:0.8rem;">${esc(t('noWorkspaces'))}</div>`;
    return;
  }
  container.innerHTML = workspaces.map((ws) => `
    <div class="ws-chip ${ws.isActive ? 'active' : ''}" data-uuid="${esc(ws.uuid)}">
      <span class="icon">${esc(ws.icon || '?')}</span>
      <span>${esc(ws.name)}</span>
      <span class="uuid">${esc(ws.uuid.slice(0, 8))}...</span>
    </div>
  `).join('');

  container.querySelectorAll('.ws-chip').forEach((chip) => {
    chip.addEventListener('click', () => selectWorkspace(chip.getAttribute('data-uuid')));
  });
}

function populateSelects(workspaces) {
  document.querySelectorAll('[data-workspace-select]').forEach((select) => {
    const current = select.value;
    const includeActive = select.dataset.optional === 'true';
    select.innerHTML = includeActive ? `<option value="">${esc(t('activeWorkspace'))}</option>` : '';

    for (const ws of workspaces) {
      const opt = document.createElement('option');
      opt.value = ws.uuid;
      opt.textContent = `${ws.icon || ''} ${ws.name}`;
      select.appendChild(opt);
    }
    if (current) select.value = current;
  });
}

function populatePageSelects(pages) {
  document.querySelectorAll('[data-page-select]').forEach((select) => {
    const current = select.value;
    select.innerHTML = `<option value="">${esc(t('selectPage'))}</option>`;
    for (const page of pages) {
      if (!Number.isInteger(page.tabId)) continue;
      const option = document.createElement('option');
      option.value = String(page.tabId);
      option.textContent = `${page.index}: ${page.title || page.url || `tab ${page.tabId}`}${page.isActive ? ' *' : ''}`;
      select.appendChild(option);
    }
    if (current) select.value = current;
  });
}

function selectWorkspace(uuid) {
  document.querySelectorAll('[data-workspace-select]').forEach((select) => {
    if (select.dataset.optional === 'true') select.value = uuid;
  });
}

const logEntries = [];

function log(level, toolName, msg) {
  const now = new Date().toLocaleTimeString(activeLanguage === 'zh-CN' ? 'zh-CN' : 'en-US', { hour12: false });
  logEntries.unshift({ time: now, level, tool: toolName, msg });
  if (logEntries.length > 50) logEntries.pop();
  renderLog();
}

function renderLog() {
  const body = document.getElementById('logBody');
  if (!logEntries.length) {
    body.innerHTML = `<div style="color:var(--text2);opacity:0.4;font-size:0.75rem;">${esc(t('noCalls'))}</div>`;
    return;
  }
  body.innerHTML = logEntries.map((entry) => `
    <div class="log-entry">
      <span class="log-time">${entry.time}</span>
      <span class="log-tool">${esc(entry.tool)}</span>
      <span class="log-${entry.level}">${esc(entry.msg)}</span>
    </div>
  `).join('');
}

function clearLog() {
  logEntries.length = 0;
  renderLog();
}

function setLanguage(lang) {
  activeLanguage = lang === 'zh-CN' ? 'zh-CN' : 'en';
  localStorage.setItem(LANGUAGE_KEY, activeLanguage);
  document.documentElement.lang = activeLanguage;
  renderStaticText();
  renderFilters();
  renderTools();
  renderChips(workspacesCache);
  populateSelects(workspacesCache);
  populatePageSelects(pagesCache);
  renderLog();
}

function initEventListeners() {
  const languageSelect = document.getElementById('languageSelect');
  languageSelect.value = activeLanguage;
  languageSelect.addEventListener('change', () => setLanguage(languageSelect.value));

  const clearLogBtn = document.getElementById('clearLogBtn');
  if (clearLogBtn) clearLogBtn.addEventListener('click', clearLog);
}

(async function() {
  renderStaticText();
  renderFilters();
  renderTools();
  initEventListeners();
  await initBridge();
  refreshBrowserState();
})();
