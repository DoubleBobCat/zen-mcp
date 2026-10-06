export interface WorkspaceInfo {
  uuid: string;
  name: string;
  icon: string;
  isActive: boolean;
  containerTabId?: number;
}

export interface TabInfo {
  index: number;
  tabId: number | null;
  windowId?: number;
  url: string;
  title: string;
  pinned: boolean;
  isActive: boolean;
}

export interface WorkspaceDetail {
  uuid: string;
  name: string;
  icon: string;
}

export interface ListWorkspacesResult {
  workspaces: WorkspaceInfo[];
  activeWorkspace: string;
}

export interface ListWorkspaceTabsResult {
  workspace: WorkspaceDetail;
  tabs: TabInfo[];
}

export interface MoveTabResult {
  success: boolean;
  tabIndex?: number;
  targetWorkspace?: WorkspaceDetail;
}

export interface ManageWorkspaceResult {
  uuid?: string;
  name?: string;
  icon?: string;
  success?: boolean;
}

// Navigation tools
export interface NavigateResult {
  success: boolean;
  url: string;
}

export interface ListPagesResult {
  pages: PageInfo[];
  activePageIndex: number;
}

export interface PageInfo {
  index: number;
  tabId?: number;
  windowId?: number;
  url: string;
  title: string;
  isActive: boolean;
}

export interface PageTarget {
  tabId: number;
  workspaceId?: string;
  expectedUrl?: string;
}

export interface SelectPageResult {
  success: boolean;
  pageIndex: number;
}

export interface NewTabResult {
  success: boolean;
  tabIndex: number;
  url?: string;
}

export interface CloseTabResult {
  success: boolean;
  tabIndex: number;
}

export type SearchEngine = "google" | "bing" | "duckduckgo" | "arxiv" | "bioarxiv" | "pubmed" | "google_scholar";


// Inspection tools
export interface SnapshotResult {
  snapshot: string;
  url: string;
  title: string;
}

export interface ScreenshotResult {
  data: string; // base64 encoded
  url: string;
  title: string;
}

export interface PageTextResult {
  url: string;
  title: string;
  text: string;
}

export interface FormField {
  name: string;
  type: string;
  label: string;
  value: string;
  selector: string;
  options?: string[];
}

export interface GetFormFieldsResult {
  url: string;
  title: string;
  fields: FormField[];
}

// Interaction tools
export interface ClickResult {
  success: boolean;
  selector: string;
}

export interface FillResult {
  success: boolean;
  selector: string;
  value: string;
}

export interface SelectOptionResult {
  success: boolean;
  selector: string;
  value: string;
}

export interface CheckResult {
  success: boolean;
  selector: string;
  checked: boolean;
}

export interface PressKeyResult {
  success: boolean;
  key: string;
}

export interface FillFormResult {
  success: boolean;
  fields: { selector: string; value: string }[];
}

export interface ScrollResult {
  success: boolean;
  selector?: string;
  direction: string;
}

// Utility tools
export interface EvaluateResult {
  result: any;
  success: boolean;
}

export interface WaitResult {
  success: boolean;
  milliseconds: number;
}

export interface WaitForResult {
  success: boolean;
  found: boolean;
  selector?: string;
  text?: string;
}

export interface ReconnectResult {
  success: boolean;
}
