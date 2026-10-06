import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import {
  listWorkspaces,
  listWorkspaceTabs,
  moveTabInWorkspace,
  moveTabToWorkspace,
  manageWorkspace,
  navigate,
  listPages,
  selectPage,
  newTab,
  closeTab,
  snapshot,
  screenshot,
  getPageText,
  getFormFields,
  click,
  fill,
  selectOption,
  check,
  pressKey,
  fillForm,
  scroll,
  evaluate,
  wait,
  waitFor,
  reconnect,
} from "./tools/index.js";

export function createServer(): McpServer {
  const server = new McpServer({
    name: "zen-mcp",
    version: "0.1.2",
  });

  server.tool("zen_list_workspaces", {}, async () => {
    try {
      const result = listWorkspaces();
      return {
        content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
      };
    } catch (e) {
      return {
        isError: true,
        content: [{ type: "text", text: String(e) }],
      };
    }
  });

  server.tool(
    "zen_list_workspace_tabs",
    { workspaceId: z.string().optional() },
    async ({ workspaceId }) => {
      try {
        const result = listWorkspaceTabs(workspaceId);
        return {
          content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
        };
      } catch (e) {
        return {
          isError: true,
          content: [{ type: "text", text: String(e) }],
        };
      }
    }
  );

  server.tool(
    "zen_move_tab_in_workspace",
    {
      tabIndex: z.number().int().min(0),
      newIndex: z.number().int().min(0),
      workspaceId: z.string().optional(),
    },
    async ({ tabIndex, newIndex, workspaceId }) => {
      try {
        const result = moveTabInWorkspace(tabIndex, newIndex, workspaceId);
        return {
          content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
        };
      } catch (e) {
        return {
          isError: true,
          content: [{ type: "text", text: String(e) }],
        };
      }
    }
  );

  server.tool(
    "zen_move_tab_to_workspace",
    {
      tabIndex: z.number().int().min(0),
      targetWorkspaceId: z.string(),
      sourceWorkspaceId: z.string().optional(),
    },
    async ({ tabIndex, targetWorkspaceId, sourceWorkspaceId }) => {
      try {
        const result = moveTabToWorkspace(
          tabIndex,
          targetWorkspaceId,
          sourceWorkspaceId
        );
        return {
          content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
        };
      } catch (e) {
        return {
          isError: true,
          content: [{ type: "text", text: String(e) }],
        };
      }
    }
  );

  server.tool(
    "zen_manage_workspace",
    {
      action: z.enum(["create", "delete", "rename"]),
      workspaceId: z.string().optional(),
      name: z.string().optional(),
    },
    async ({ action, workspaceId, name }) => {
      try {
        const result = await manageWorkspace(action, workspaceId, name);
        return {
          content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
        };
      } catch (e) {
        return {
          isError: true,
          content: [{ type: "text", text: String(e) }],
        };
      }
    }
  );

  // Navigation tools
  server.tool("zen_navigate", { url: z.string() }, async ({ url }) => {
    try {
      const result = navigate(url);
      return {
        content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
      };
    } catch (e) {
      return {
        isError: true,
        content: [{ type: "text", text: String(e) }],
      };
    }
  });

  server.tool("zen_list_pages", {}, async () => {
    try {
      const result = listPages();
      return {
        content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
      };
    } catch (e) {
      return {
        isError: true,
        content: [{ type: "text", text: String(e) }],
      };
    }
  });

  server.tool("zen_select_page", { pageIndex: z.number().int().min(0) }, async ({ pageIndex }) => {
    try {
      const result = selectPage(pageIndex);
      return {
        content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
      };
    } catch (e) {
      return {
        isError: true,
        content: [{ type: "text", text: String(e) }],
      };
    }
  });

  server.tool("zen_new_tab", { url: z.string().optional() }, async ({ url }) => {
    try {
      const result = newTab(url);
      return {
        content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
      };
    } catch (e) {
      return {
        isError: true,
        content: [{ type: "text", text: String(e) }],
      };
    }
  });

  server.tool("zen_close_tab", { tabIndex: z.number().int().min(0) }, async ({ tabIndex }) => {
    try {
      const result = closeTab(tabIndex);
      return {
        content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
      };
    } catch (e) {
      return {
        isError: true,
        content: [{ type: "text", text: String(e) }],
      };
    }
  });

  // Inspection tools
  server.tool("zen_snapshot", { filter: z.enum(["all", "interactive", "form"]).optional() }, async ({ filter }) => {
    try {
      const result = snapshot(filter);
      return {
        content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
      };
    } catch (e) {
      return {
        isError: true,
        content: [{ type: "text", text: String(e) }],
      };
    }
  });

  server.tool("zen_screenshot", {}, async () => {
    try {
      const result = screenshot();
      return {
        content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
      };
    } catch (e) {
      return {
        isError: true,
        content: [{ type: "text", text: String(e) }],
      };
    }
  });

  server.tool("zen_get_page_text", {}, async () => {
    try {
      const result = getPageText();
      return {
        content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
      };
    } catch (e) {
      return {
        isError: true,
        content: [{ type: "text", text: String(e) }],
      };
    }
  });

  server.tool("zen_get_form_fields", {}, async () => {
    try {
      const result = getFormFields();
      return {
        content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
      };
    } catch (e) {
      return {
        isError: true,
        content: [{ type: "text", text: String(e) }],
      };
    }
  });

  // Interaction tools
  server.tool("zen_click", { selector: z.string() }, async ({ selector }) => {
    try {
      const result = click(selector);
      return {
        content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
      };
    } catch (e) {
      return {
        isError: true,
        content: [{ type: "text", text: String(e) }],
      };
    }
  });

  server.tool("zen_fill", { selector: z.string(), value: z.string() }, async ({ selector, value }) => {
    try {
      const result = fill(selector, value);
      return {
        content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
      };
    } catch (e) {
      return {
        isError: true,
        content: [{ type: "text", text: String(e) }],
      };
    }
  });

  server.tool("zen_select_option", { selector: z.string(), value: z.string(), by: z.enum(["value", "text"]).optional() }, async ({ selector, value, by }) => {
    try {
      const result = selectOption(selector, value, by);
      return {
        content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
      };
    } catch (e) {
      return {
        isError: true,
        content: [{ type: "text", text: String(e) }],
      };
    }
  });

  server.tool("zen_check", { selector: z.string(), checked: z.boolean() }, async ({ selector, checked }) => {
    try {
      const result = check(selector, checked);
      return {
        content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
      };
    } catch (e) {
      return {
        isError: true,
        content: [{ type: "text", text: String(e) }],
      };
    }
  });

  server.tool("zen_press_key", { key: z.string() }, async ({ key }) => {
    try {
      const result = pressKey(key);
      return {
        content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
      };
    } catch (e) {
      return {
        isError: true,
        content: [{ type: "text", text: String(e) }],
      };
    }
  });

  server.tool("zen_fill_form", { fields: z.array(z.object({ selector: z.string(), action: z.enum(["fill", "select", "check", "uncheck", "click"]), value: z.string().optional(), by: z.enum(["value", "text"]).optional() })) }, async ({ fields }) => {
    try {
      const result = fillForm(fields);
      return {
        content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
      };
    } catch (e) {
      return {
        isError: true,
        content: [{ type: "text", text: String(e) }],
      };
    }
  });

  server.tool("zen_scroll", { direction: z.enum(["up", "down", "left", "right"]), amount: z.number().optional(), selector: z.string().optional() }, async ({ direction, amount, selector }) => {
    try {
      const result = scroll(direction, amount, selector);
      return {
        content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
      };
    } catch (e) {
      return {
        isError: true,
        content: [{ type: "text", text: String(e) }],
      };
    }
  });

  // Utility tools
  server.tool("zen_evaluate", { script: z.string() }, async ({ script }) => {
    try {
      const result = evaluate(script);
      return {
        content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
      };
    } catch (e) {
      return {
        isError: true,
        content: [{ type: "text", text: String(e) }],
      };
    }
  });

  server.tool("zen_wait", { milliseconds: z.number().int().min(0) }, async ({ milliseconds }) => {
    try {
      const result = await wait(milliseconds);
      return {
        content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
      };
    } catch (e) {
      return {
        isError: true,
        content: [{ type: "text", text: String(e) }],
      };
    }
  });

  server.tool("zen_wait_for", { selector: z.string().optional(), text: z.string().optional(), timeout: z.number().int().min(0).optional() }, async ({ selector, text, timeout }) => {
    try {
      const result = await waitFor({ selector, text, timeout });
      return {
        content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
      };
    } catch (e) {
      return {
        isError: true,
        content: [{ type: "text", text: String(e) }],
      };
    }
  });

  server.tool("zen_reconnect", {}, async () => {
    try {
      const result = reconnect();
      return {
        content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
      };
    } catch (e) {
      return {
        isError: true,
        content: [{ type: "text", text: String(e) }],
      };
    }
  });

  return server;
}
