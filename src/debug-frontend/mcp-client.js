class MCPClient {
  constructor(url = 'ws://localhost:9222') {
    this.url = url;
    this.ws = null;
    this.pendingRequests = new Map();
    this.requestId = 0;
  }

  connect() {
    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(this.url);

      this.ws.onopen = () => {
        console.log('Connected to MCP server');
        resolve();
      };

      this.ws.onmessage = (event) => {
        const response = JSON.parse(event.data);
        const pending = this.pendingRequests.get(response.id);
        if (pending) {
          this.pendingRequests.delete(response.id);
          try {
            if (response.error) {
              pending.reject(new Error(response.error.message));
            } else {
              pending.resolve(this.parseToolResult(response.result));
            }
          } catch (e) {
            pending.reject(e);
          }
        }
      };

      this.ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        reject(error);
      };

      this.ws.onclose = () => {
        console.log('Disconnected from MCP server');
        for (const pending of this.pendingRequests.values()) {
          pending.reject(new Error('Disconnected from MCP server'));
        }
        this.pendingRequests.clear();
        setStatus(false, 'Disconnected from MCP server');
      };
    });
  }

  parseToolResult(result) {
    if (!result || !Array.isArray(result.content)) {
      return result;
    }

    const text = result.content[0]?.text ?? '';
    if (result.isError) {
      throw new Error(text || 'Tool call failed');
    }

    try {
      return JSON.parse(text);
    } catch {
      return text;
    }
  }

  callTool(name, args = {}) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      return Promise.reject(new Error('MCP server is not connected'));
    }
    return new Promise((resolve, reject) => {
      const id = ++this.requestId;
      const request = {
        jsonrpc: '2.0',
        method: 'tools/call',
        params: { name, arguments: args },
        id
      };

      this.pendingRequests.set(id, { resolve, reject });
      this.ws.send(JSON.stringify(request));
    });
  }

  listTools() {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      return Promise.reject(new Error('MCP server is not connected'));
    }
    return new Promise((resolve, reject) => {
      const id = ++this.requestId;
      const request = {
        jsonrpc: '2.0',
        method: 'tools/list',
        id
      };

      this.pendingRequests.set(id, { resolve, reject });
      this.ws.send(JSON.stringify(request));
    });
  }

  disconnect() {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }
}

// Export for use in debug.js
window.MCPClient = MCPClient;
