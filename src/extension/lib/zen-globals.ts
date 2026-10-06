export interface ZenWorkspace {
  uuid: string;
  name: string;
  icon?: string;
  containerTabId?: number;
}

export interface ZenTab {
  linkedBrowser: { currentURI: { spec: string } };
  label: string;
  pinned: boolean;
  hasAttribute(name: string): boolean;
  getAttribute(name: string): string;
}

export interface CreateOptions {
  beforeChangeCallback?: (ws: ZenWorkspace) => Promise<void>;
}

export interface ZenWorkspacesAPI {
  activeWorkspace: string;
  getWorkspaces(): ZenWorkspace[];
  getActiveWorkspace(): ZenWorkspace;
  getWorkspaceFromId(id: string): ZenWorkspace | null;
  createAndSaveWorkspace(
    name: string,
    icon: undefined,
    reorder: boolean,
    containerTabId: number,
    options?: CreateOptions
  ): Promise<ZenWorkspace>;
  removeWorkspace(id: string): Promise<void>;
  saveWorkspace(ws: ZenWorkspace): void;
  moveTabToWorkspace(tab: ZenTab, workspaceId: string): boolean;
}

export interface ZenBrowserAPI {
  tabs: ZenTab[];
  selectedTab: ZenTab;
  moveTabTo(tab: ZenTab, options: { tabIndex: number }): void;
  // Navigation
  loadURI(uri: string): void;
  // Tab management
  addTab(url: string): ZenTab;
  removeTab(tab: ZenTab): void;
  selectTab(tab: ZenTab): void;
  // Page interaction
  getContentDocument(): Document;
  // Snapshot/screenshot
  getSnapshot(): string;
  getScreenshot(): string;
  // Form interaction
  getElementBySelector(selector: string): Element | null;
  // Keyboard
  sendKeyEvent(key: string, modifiers?: { [key: string]: boolean }): void;
  // Scroll
  scrollBy(x: number, y: number): void;
  scrollToElement(selector: string): void;
  // JavaScript execution
  executeScript(script: string): any;
}

export interface ZenPageAPI {
  getContentDocument(): Document;
  getLocation(): string;
  getTitle(): string;
}

declare global {
  const gZenWorkspaces: ZenWorkspacesAPI;
  const gBrowser: ZenBrowserAPI;
  const gPage: ZenPageAPI;
}
