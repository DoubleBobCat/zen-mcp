import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";

function loadNetworkCapture() {
  const listeners = new Map();
  const filters = new Map();
  let filterCookies = true;
  const event = (name) => ({ addListener(listener) { listeners.set(name, listener); } });
  const context = {
    URL, Headers, Response, DecompressionStream, CompressionStream, TextEncoder, TextDecoder, Uint8Array, ArrayBuffer, setTimeout, clearTimeout,
    btoa, atob, Math, console, globalThis: null,
    browser: {
      storage: { local: { async get() { return { filterNetworkCookies: filterCookies }; } } },
      tabs: { async get(tabId) { return { id: tabId, url: "https://example.test/" }; } },
      cookies: { async getAll() { return [{ name: "sid", value: "secret" }]; } },
      webRequest: {
        onBeforeRequest: event("beforeRequest"),
        onBeforeSendHeaders: event("beforeSendHeaders"),
        onHeadersReceived: event("headersReceived"),
        onCompleted: event("completed"),
        onErrorOccurred: event("error"),
        filterResponseData(requestId) {
          const filter = {
            writes: [],
            write(data) { this.writes.push(data); },
            close() { this.closed = true; },
            disconnect() { this.disconnected = true; },
          };
          filters.set(requestId, filter);
          return filter;
        },
      },
    },
  };
  context.globalThis = context;
  vm.runInNewContext(readFileSync("src/extension/network-capture.js", "utf8"), context);
  return {
    capture: context.zenNetworkCapture,
    context,
    listeners,
    filters,
    setFilterCookies(value) { filterCookies = value; },
  };
}

async function createRecord(harness) {
  const started = await harness.capture.start({ tabId: 7 }, { sessionId: "owner-a" });
  harness.listeners.get("beforeRequest")({
    requestId: "request-1", tabId: 7, url: "https://example.test/api/data", method: "GET",
    type: "xmlhttprequest", documentUrl: "https://example.test/page", timeStamp: 100,
  });
  harness.listeners.get("beforeSendHeaders")({ requestId: "request-1", requestHeaders: [
    { name: "Cookie", value: "sid=secret" }, { name: "X-Test", value: "visible" },
  ] });
  harness.listeners.get("headersReceived")({ requestId: "request-1", statusCode: 200, statusLine: "HTTP/2 200", responseHeaders: [
    { name: "Content-Type", value: "application/json" }, { name: "Set-Cookie", value: "sid=secret" },
  ] });
  const filter = harness.filters.get("request-1");
  filter.ondata({ data: new TextEncoder().encode('{"ok":true}').buffer });
  filter.onstop();
  harness.listeners.get("completed")({ requestId: "request-1", statusCode: 200, timeStamp: 120 });
  const listed = await harness.capture.list({ networkSessionId: started.networkSessionId, tabId: 7 }, { sessionId: "owner-a" });
  return { started, record: listed.records[0] };
}

async function createCompressedRecord(harness, encoding, bytes) {
  const started = await harness.capture.start({ tabId: 7 }, { sessionId: "owner-a" });
  harness.listeners.get("beforeRequest")({
    requestId: "compressed-1", tabId: 7, url: "https://example.test/api/compressed", method: "GET",
    type: "xmlhttprequest", documentUrl: "https://example.test/page", timeStamp: 100,
  });
  harness.listeners.get("headersReceived")({ requestId: "compressed-1", statusCode: 200, statusLine: "HTTP/2 200", responseHeaders: [
    { name: "Content-Type", value: "application/json" }, { name: "Content-Encoding", value: encoding },
  ] });
  const filter = harness.filters.get("compressed-1");
  filter.ondata({ data: bytes.buffer });
  filter.onstop();
  harness.listeners.get("completed")({ requestId: "compressed-1", statusCode: 200, timeStamp: 120 });
  const listed = await harness.capture.list({ networkSessionId: started.networkSessionId, tabId: 7 }, { sessionId: "owner-a" });
  return { started, record: listed.records[0] };
}

test("network capture isolates owner and tab and filters credential headers by default", async () => {
  const harness = loadNetworkCapture();
  const { started, record } = await createRecord(harness);
  try {
    assert.equal(record.url, "https://example.test/api/data");
    assert.deepEqual(JSON.parse(JSON.stringify(record.requestHeaders)), [{ name: "X-Test", value: "visible" }]);
    assert.deepEqual(JSON.parse(JSON.stringify(record.responseHeaders)), [{ name: "Content-Type", value: "application/json" }]);
    assert.equal(record.responseBodyState, "available_base64");
    await assert.rejects(
      harness.capture.list({ networkSessionId: started.networkSessionId, tabId: 8 }, { sessionId: "owner-a" }),
      /NETWORK_SESSION_TAB_MISMATCH/,
    );
    await assert.rejects(
      harness.capture.list({ networkSessionId: started.networkSessionId, tabId: 7 }, { sessionId: "owner-b" }),
      /NETWORK_SESSION_OWNER_MISMATCH/,
    );
  } finally {
    await harness.capture.stop({ networkSessionId: started.networkSessionId, tabId: 7 }, { sessionId: "owner-a" });
  }
});

test("network capture setting changes only the returned header projection", async () => {
  const harness = loadNetworkCapture();
  const { started } = await createRecord(harness);
  try {
    harness.setFilterCookies(false);
    const listed = await harness.capture.list({ networkSessionId: started.networkSessionId, tabId: 7 }, { sessionId: "owner-a" });
    assert.deepEqual(JSON.parse(JSON.stringify(listed.records[0].requestHeaders)), [
      { name: "Cookie", value: "sid=secret" }, { name: "X-Test", value: "visible" },
    ]);
    assert.equal(listed.records[0].responseHeaders.some((header) => header.name === "Set-Cookie"), true);
  } finally {
    await harness.capture.stop({ networkSessionId: started.networkSessionId, tabId: 7 }, { sessionId: "owner-a" });
  }
});

test("stopping a network session clears records", async () => {
  const harness = loadNetworkCapture();
  const { started } = await createRecord(harness);
  const stopped = await harness.capture.stop({ networkSessionId: started.networkSessionId, tabId: 7 }, { sessionId: "owner-a" });
  assert.equal(stopped.success, true);
  assert.equal(stopped.removedRecordCount, 1);
  await assert.rejects(
    harness.capture.list({ networkSessionId: started.networkSessionId, tabId: 7 }, { sessionId: "owner-a" }),
    /NETWORK_SESSION_NOT_FOUND/,
  );
});

test("network capture stages and decompresses gzip response bodies", async () => {
  const staged = [];
  const harness = loadNetworkCapture();
  harness.context.browser.zenMcp = {
    async roundTripTempBase64(value) {
      staged.push(value);
      return value;
    },
  };
  const source = new TextEncoder().encode('{"compressed":true}');
  const reader = new Response(source).body.pipeThrough(new CompressionStream("gzip")).getReader();
  const chunks = [];
  while (true) {
    const result = await reader.read();
    if (result.done) break;
    chunks.push(new Uint8Array(result.value));
  }
  const compressed = chunks.reduce((all, chunk) => {
    const output = new Uint8Array(all.length + chunk.length);
    output.set(all); output.set(chunk, all.length); return output;
  }, new Uint8Array());
  const { started, record } = await createCompressedRecord(harness, "gzip", compressed);
  try {
    assert.equal(record.responseBodyState, "available_base64");
    const response = await harness.capture.getResponse(
      { networkSessionId: started.networkSessionId, tabId: 7, recordId: record.id },
      { sessionId: "owner-a" },
    );
    assert.deepEqual(Buffer.from(response.bodyBase64, "base64"), Buffer.from(source));
    assert.equal(staged.length, 1);
  } finally {
    await harness.capture.stop({ networkSessionId: started.networkSessionId, tabId: 7 }, { sessionId: "owner-a" });
  }
});

test("network capture reports unsupported compressed response bodies explicitly", async () => {
  const harness = loadNetworkCapture();
  harness.context.browser.zenMcp = { async roundTripTempBase64(value) { return value; } };
  const { started, record } = await createCompressedRecord(harness, "br", new Uint8Array([0, 1, 2, 255, 0, 3]));
  try {
    assert.equal(record.responseBodyState, "unavailable_decompression");
    const response = await harness.capture.getResponse(
      { networkSessionId: started.networkSessionId, tabId: 7, recordId: record.id },
      { sessionId: "owner-a" },
    );
    assert.equal(response.bodyBase64, "");
  } finally {
    await harness.capture.stop({ networkSessionId: started.networkSessionId, tabId: 7 }, { sessionId: "owner-a" });
  }
});

test("network capture keeps already-decoded text when encoding metadata remains", async () => {
  const harness = loadNetworkCapture();
  harness.context.browser.zenMcp = { async roundTripTempBase64(value) { return value; } };
  const source = new TextEncoder().encode("already decoded JavaScript text");
  const { started, record } = await createCompressedRecord(harness, "gzip", source);
  try {
    assert.equal(record.responseBodyState, "available_base64");
    const response = await harness.capture.getResponse(
      { networkSessionId: started.networkSessionId, tabId: 7, recordId: record.id },
      { sessionId: "owner-a" },
    );
    assert.deepEqual(Buffer.from(response.bodyBase64, "base64"), Buffer.from(source));
  } finally {
    await harness.capture.stop({ networkSessionId: started.networkSessionId, tabId: 7 }, { sessionId: "owner-a" });
  }
});
