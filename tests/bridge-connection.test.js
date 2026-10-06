import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";

function loadManager() {
  const context = {
    console: { log() {}, error() {} },
    setInterval(fn) {
      context.intervalFn = fn;
      return 1;
    },
    clearInterval(id) {
      context.clearedIntervals.push(id);
    },
    globalThis: null,
  };
  context.globalThis = context;
  context.clearedIntervals = [];
  vm.runInNewContext(readFileSync("src/extension/bridge-connection.js", "utf8"), context);
  return context;
}

class FakeWebSocket {
  static CONNECTING = 0;
  static OPEN = 1;
  static CLOSING = 2;
  static CLOSED = 3;

  constructor(url) {
    this.url = url;
    this.readyState = FakeWebSocket.CONNECTING;
    this.sent = [];
    FakeWebSocket.instances.push(this);
  }

  send(data) {
    if (this.readyState !== FakeWebSocket.OPEN) {
      throw new Error("Cannot send on a socket that is not open");
    }
    this.sent.push(data);
  }

  close() {
    this.readyState = FakeWebSocket.CLOSED;
    if (this.onclose) {
      this.onclose();
    }
  }
}
FakeWebSocket.instances = [];

function createHarness(options = {}) {
  FakeWebSocket.instances = [];
  const context = loadManager();
  const statuses = [];
  const handled = [];
  const manager = context.createBridgeConnectionManager({
    WebSocketCtor: FakeWebSocket,
    setStatus(status) {
      statuses.push(status);
    },
    handleMessage(message) {
      handled.push(message);
      if (options.handleMessage) {
        return options.handleMessage(message);
      }
      return { jsonrpc: "2.0", id: message.id, result: { ok: true } };
    },
    log() {},
    logError() {},
  });
  return { context, manager, statuses, handled };
}

test("stale socket close does not clear newer active socket", () => {
  const { manager, statuses } = createHarness();
  const settings = { url: "ws://localhost:9222?type=extension", reconnectInterval: 5000 };

  manager.connect(settings);
  const first = FakeWebSocket.instances[0];
  first.readyState = FakeWebSocket.OPEN;
  first.onopen();

  first.readyState = FakeWebSocket.CLOSED;
  manager.connect(settings);
  const second = FakeWebSocket.instances[1];
  second.readyState = FakeWebSocket.OPEN;
  second.onopen();

  first.onclose();

  assert.equal(manager.currentSocket(), second);
  assert.equal(manager.currentSocket().readyState, FakeWebSocket.OPEN);
  assert.deepEqual(statuses, ["connected", "connected"]);
});

test("active socket sends response on itself even if current socket changes while handling", () => {
  let manager;
  let first;
  let second;
  const settings = { url: "ws://localhost:9222?type=extension", reconnectInterval: 5000 };
  const harness = createHarness({
    handleMessage(message) {
      first.readyState = FakeWebSocket.CLOSED;
      manager.connect(settings);
      second = FakeWebSocket.instances[1];
      second.readyState = FakeWebSocket.OPEN;
      second.onopen();
      first.readyState = FakeWebSocket.OPEN;
      return { jsonrpc: "2.0", id: message.id, result: { ok: true } };
    },
  });
  manager = harness.manager;

  manager.connect(settings);
  first = FakeWebSocket.instances[0];
  first.readyState = FakeWebSocket.OPEN;
  first.onopen();

  first.onmessage({ data: JSON.stringify({ jsonrpc: "2.0", id: "active", method: "tools/list" }) });

  assert.equal(manager.currentSocket(), second);
  assert.equal(first.sent.length, 1);
  assert.equal(second.sent.length, 0);
  assert.match(first.sent[0], /"id":"active"/);
});

test("stale socket messages are ignored", () => {
  const { manager, handled } = createHarness();
  const settings = { url: "ws://localhost:9222?type=extension", reconnectInterval: 5000 };

  manager.connect(settings);
  const first = FakeWebSocket.instances[0];
  first.readyState = FakeWebSocket.OPEN;
  first.onopen();

  first.readyState = FakeWebSocket.CLOSED;
  manager.connect(settings);
  const second = FakeWebSocket.instances[1];
  second.readyState = FakeWebSocket.OPEN;
  second.onopen();

  assert.equal(manager.currentSocket(), second);
  first.readyState = FakeWebSocket.OPEN;
  first.onmessage({ data: JSON.stringify({ jsonrpc: "2.0", id: "old", method: "tools/list" }) });

  assert.equal(handled.length, 0);
  assert.equal(first.sent.length, 0);
  assert.equal(second.sent.length, 0);
});

test("connect does not create overlapping attempts while socket is connecting or open", () => {
  const { manager } = createHarness();
  const settings = { url: "ws://localhost:9222?type=extension", reconnectInterval: 5000 };

  manager.connect(settings);
  manager.connect(settings);
  assert.equal(FakeWebSocket.instances.length, 1);

  const socket = FakeWebSocket.instances[0];
  socket.readyState = FakeWebSocket.OPEN;
  socket.onopen();
  manager.connect(settings);
  assert.equal(FakeWebSocket.instances.length, 1);
});

test("stop clears reconnect interval and closes without scheduling reconnect", () => {
  const { context, manager, statuses } = createHarness();
  const settings = { url: "ws://localhost:9222?type=extension", reconnectInterval: 5000 };

  manager.connect(settings);
  const socket = FakeWebSocket.instances[0];
  socket.readyState = FakeWebSocket.OPEN;
  socket.onopen();

  socket.readyState = FakeWebSocket.CLOSED;
  socket.onclose();
  assert.equal(manager.currentSocket(), null);
  assert.equal(typeof context.intervalFn, "function");

  context.intervalFn();
  const reconnecting = FakeWebSocket.instances[1];

  manager.stop();

  assert.deepEqual(context.clearedIntervals, [1]);
  assert.equal(manager.currentSocket(), null);
  assert.equal(reconnecting.onclose, null);
  assert.deepEqual(statuses, ["connected", "disconnected"]);
});
