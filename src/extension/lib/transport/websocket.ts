import { Transport, TransportSendOptions } from "@modelcontextprotocol/sdk/shared/transport.js";
import { JSONRPCMessage, MessageExtraInfo } from "@modelcontextprotocol/sdk/types.js";
import { WebSocketServer, WebSocket } from "ws";

export class WebSocketServerTransport implements Transport {
  private wss!: WebSocketServer;
  private clients: Set<WebSocket> = new Set();

  onclose?: () => void;
  onerror?: (error: Error) => void;
  onmessage?: <T extends JSONRPCMessage>(message: T, extra?: MessageExtraInfo) => void;

  constructor(private port: number = 9222) {}

  async start(): Promise<void> {
    this.wss = new WebSocketServer({ port: this.port });

    this.wss.on("connection", (ws) => {
      this.clients.add(ws);
      console.log(`Client connected. Total clients: ${this.clients.size}`);

      ws.on("message", (data) => {
        try {
          const message = JSON.parse(data.toString());
          this.onmessage?.(message);
        } catch (error) {
          this.onerror?.(new Error(`Failed to parse message: ${error}`));
        }
      });

      ws.on("close", () => {
        this.clients.delete(ws);
        console.log(`Client disconnected. Total clients: ${this.clients.size}`);
      });

      ws.on("error", (error) => {
        this.onerror?.(error);
      });
    });

    console.log(`WebSocket MCP server listening on port ${this.port}`);
  }

  async send(message: JSONRPCMessage, _options?: TransportSendOptions): Promise<void> {
    const data = JSON.stringify(message);
    const promises: Promise<void>[] = [];

    for (const client of this.clients) {
      if (client.readyState === WebSocket.OPEN) {
        promises.push(
          new Promise((resolve, reject) => {
            client.send(data, (error) => {
              if (error) reject(error);
              else resolve();
            });
          }),
        );
      }
    }

    await Promise.all(promises);
  }

  async close(): Promise<void> {
    for (const client of this.clients) {
      client.close();
    }
    this.clients.clear();
    this.wss.close();
    this.onclose?.();
  }
}
