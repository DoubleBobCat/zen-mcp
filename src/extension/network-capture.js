(() => {
  const sessions = new Map();
  const requestRecords = new Map();
  const replayRules = new Map();
  const MAX_RECORDS = 500;
  const MAX_BODY_BYTES = 1024 * 1024;
  const MAX_SESSION_MS = 15 * 60 * 1000;
  const SENSITIVE_HEADERS = new Set([
    "cookie", "cookie2", "set-cookie", "set-cookie2", "authorization",
    "proxy-authorization", "www-authenticate", "proxy-authenticate",
  ]);
  const TEXT_CONTENT_TYPES = [
    "text/", "application/json", "application/ld+json", "application/javascript",
    "application/x-javascript", "application/xml", "application/graphql",
    "application/x-www-form-urlencoded", "image/svg+xml",
  ];
  const COMPRESSED_ENCODINGS = new Set(["gzip", "x-gzip", "deflate", "br"]);
  let listenersInstalled = false;

  function newId() {
    const random = globalThis.crypto?.getRandomValues
      ? globalThis.crypto.getRandomValues(new Uint32Array(4)).join("-")
      : Math.random().toString(36).slice(2);
    return `${Date.now().toString(36)}-${random}`;
  }

  function selectedSessions(tabId) {
    return [...sessions.values()].filter((session) => session.tabId === tabId);
  }

  function sessionFor(args, context) {
    const session = sessions.get(String(args?.networkSessionId ?? ""));
    if (!session) throw new Error("NETWORK_SESSION_NOT_FOUND: Network capture session does not exist or has expired");
    if (session.tabId !== args?.tabId) throw new Error("NETWORK_SESSION_TAB_MISMATCH: tabId does not match the capture session");
    if (session.ownerSessionId !== (context?.sessionId || "legacy-session")) {
      throw new Error("NETWORK_SESSION_OWNER_MISMATCH: Network capture session belongs to another MCP session");
    }
    if (session.expiresAt <= Date.now()) {
      stopSession(session.id);
      throw new Error("NETWORK_SESSION_EXPIRED: Network capture session has expired");
    }
    return session;
  }

  function boundedRecords(session) {
    while (session.records.length > MAX_RECORDS) {
      const removed = session.records.shift();
      const owners = requestRecords.get(removed.requestId)?.filter((owner) => owner !== session.id);
      if (owners?.length) requestRecords.set(removed.requestId, owners);
      else requestRecords.delete(removed.requestId);
    }
  }

  function recordForRequest(details) {
    const ids = requestRecords.get(details.requestId);
    if (!ids) return [];
    return ids.map((id) => sessions.get(id)).filter(Boolean).map((session) => session.records.find((record) => record.requestId === details.requestId)).filter(Boolean);
  }

  function bytesToBase64(bytes) {
    let binary = "";
    for (let index = 0; index < bytes.length; index += 0x8000) {
      binary += String.fromCharCode(...bytes.subarray(index, Math.min(index + 0x8000, bytes.length)));
    }
    return globalThis.btoa(binary);
  }

  function base64ToBytes(value) {
    return Uint8Array.from(atob(value), (character) => character.charCodeAt(0));
  }

  function responseContentEncoding(record) {
    const values = record.responseHeaders
      .find((header) => header.name.toLowerCase() === "content-encoding")?.value
      ?.split(",").map((value) => value.trim().toLowerCase()).filter(Boolean) || [];
    return values.length === 1 ? values[0] : values.length === 0 ? "" : "multiple";
  }

  async function boundedReadableBytes(stream) {
    const reader = stream.getReader();
    const chunks = [];
    let total = 0;
    try {
      while (true) {
        const result = await reader.read();
        if (result.done) break;
        const bytes = new Uint8Array(result.value);
        total += bytes.byteLength;
        if (total > MAX_BODY_BYTES) {
          await reader.cancel();
          return null;
        }
        chunks.push(bytes.slice());
      }
    } finally {
      reader.releaseLock();
    }
    const output = new Uint8Array(total);
    let offset = 0;
    for (const chunk of chunks) {
      output.set(chunk, offset);
      offset += chunk.byteLength;
    }
    return output;
  }

  function isLikelyTextBytes(bytes) {
    try {
      const text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
      let controlCount = 0;
      for (const character of text) {
        const code = character.charCodeAt(0);
        if (code < 0x20 && code !== 0x09 && code !== 0x0a && code !== 0x0d) controlCount++;
      }
      return controlCount <= Math.max(1, Math.floor(text.length * 0.01));
    } catch {
      return false;
    }
  }

  async function decodeResponseBody(record, bytes) {
    const encoding = responseContentEncoding(record);
    if (!encoding) return { bytes, state: "available_base64" };
    if (!COMPRESSED_ENCODINGS.has(encoding)) return { bytes: null, state: "unavailable_decompression" };
    if (!browser.zenMcp?.roundTripTempBase64) return { bytes: null, state: "unavailable_decompression" };

    try {
      // Keep the privileged file operation separate from decompression. This
      // bounds the extension-side staging lifetime and gives the parent API a
      // single finally path for cleanup.
      const stagedBase64 = await browser.zenMcp.roundTripTempBase64(bytesToBase64(bytes));
      const stagedBytes = base64ToBytes(stagedBase64);
      const format = encoding === "x-gzip" ? "gzip" : encoding;
      const decompressor = new DecompressionStream(format);
      const decoded = await boundedReadableBytes(new Response(stagedBytes).body.pipeThrough(decompressor));
      if (!decoded) return { bytes: null, state: "unavailable_too_large" };
      return { bytes: decoded, state: "available_base64" };
    } catch {
      // Firefox may expose already decoded text for a cached resource while
      // retaining the original Content-Encoding response header. Do not try
      // to decompress that text a second time.
      if (TEXT_CONTENT_TYPES.some((prefix) => {
        const contentType = record.responseHeaders
          .find((header) => header.name.toLowerCase() === "content-type")?.value?.toLowerCase() || "";
        return contentType.startsWith(prefix);
      }) && isLikelyTextBytes(bytes)) {
        return { bytes, state: "available_base64" };
      }
      return { bytes: null, state: "unavailable_decompression" };
    }
  }

  async function finishResponseBody(record, chunks, total, exceeded) {
    record.responseSize = total;
    if (record.responseBodyState === "unavailable_binary") {
      record.responseBody = "";
      return;
    }
    if (exceeded) {
      record.responseBodyState = "unavailable_too_large";
      return;
    }
    const all = new Uint8Array(total);
    let offset = 0;
    for (const chunk of chunks) { all.set(chunk, offset); offset += chunk.length; }
    const decoded = await decodeResponseBody(record, all);
    record.responseBody = decoded.bytes ? bytesToBase64(decoded.bytes) : "";
    record.responseBodyState = decoded.state;
  }

  function requestBody(details) {
    const body = details.requestBody;
    if (!body) return undefined;
    if (body.formData) return { kind: "formData", value: body.formData };
    if (!body.raw) return undefined;
    const parts = [];
    let total = 0;
    for (const item of body.raw) {
      if (!item.bytes) continue;
      const bytes = new Uint8Array(item.bytes);
      total += bytes.byteLength;
      if (total > MAX_BODY_BYTES) return { kind: "unavailable", bodyState: "unavailable_too_large", size: total };
      parts.push(bytesToBase64(bytes));
    }
    return { kind: "base64", value: parts.join(""), size: total };
  }

  function headersArray(headers = []) {
    return headers.map(({ name, value, binaryValue }) => ({
      name: String(name),
      value: value === undefined ? (binaryValue ? bytesToBase64(new Uint8Array(binaryValue)) : "") : String(value),
    }));
  }

  function activeCookieFilter() {
    return browser.storage.local.get("filterNetworkCookies").then((result) => result.filterNetworkCookies !== false);
  }

  async function publicHeaders(headers) {
    const filterCookies = await activeCookieFilter();
    return (headers || []).filter((header) => !filterCookies || !SENSITIVE_HEADERS.has(header.name.toLowerCase()));
  }

  function captureRequest(details) {
    if (details.tabId < 0) return;
    const active = selectedSessions(details.tabId);
    if (!active.length) return;
    const capturedBody = requestBody(details);
    const record = {
      id: newId(), requestId: details.requestId, tabId: details.tabId,
      url: details.url, method: details.method, type: details.type,
      documentUrl: details.documentUrl || details.originUrl || "",
      frameId: details.frameId, startedAt: details.timeStamp || Date.now(),
      requestHeaders: [], requestBody: capturedBody,
      requestBodyState: details.requestBody ? (capturedBody?.bodyState || "available") : "unavailable",
      responseHeaders: [], responseBody: "", responseBodyState: "unavailable_stream",
      responseSize: 0,
    };
    for (const session of active) {
      session.records.push(record);
      boundedRecords(session);
    }
    requestRecords.set(details.requestId, active.map((item) => item.id));
    attachResponseFilter(details);
    return {};
  }

  function attachResponseFilter(details) {
    if (!browser.webRequest?.filterResponseData) return;
    for (const record of recordForRequest(details)) {
      if (record.responseFilterAttached) continue;
      record.responseFilterAttached = true;
      try {
        const filter = browser.webRequest.filterResponseData(details.requestId);
        const chunks = [];
        let total = 0;
        let exceeded = false;
        filter.ondata = (event) => {
          const bytes = new Uint8Array(event.data);
          total += bytes.byteLength;
          if (!exceeded && total <= MAX_BODY_BYTES) chunks.push(bytes.slice());
          else exceeded = true;
          filter.write(event.data);
        };
        filter.onstop = () => {
          record.responseBodyState = exceeded ? "unavailable_too_large" : "processing";
          record.responseBodyReady = finishResponseBody(record, chunks, total, exceeded)
            .catch(() => {
              record.responseBody = "";
              record.responseBodyState = "unavailable_decompression";
            });
          filter.close();
        };
        filter.onerror = () => {
          record.responseBodyState = "unavailable_stream";
          record.responseBodyReady = Promise.resolve();
          try { filter.disconnect(); } catch {}
        };
      } catch {
        record.responseBodyState = "unavailable_stream";
        record.responseBodyReady = Promise.resolve();
      }
    }
  }

  function captureRequestHeaders(details) {
    for (const record of recordForRequest(details)) record.requestHeaders = headersArray(details.requestHeaders);
  }

  function captureResponseHeaders(details) {
    for (const record of recordForRequest(details)) {
      record.statusCode = details.statusCode;
      record.statusLine = details.statusLine;
      record.responseHeaders = headersArray(details.responseHeaders);
      record.fromCache = Boolean(details.fromCache);
      const contentType = record.responseHeaders.find((header) => header.name.toLowerCase() === "content-type")?.value?.toLowerCase() || "";
      if (contentType && !TEXT_CONTENT_TYPES.some((prefix) => contentType.startsWith(prefix))) {
        record.responseBodyState = "unavailable_binary";
      }
    }
    return {};
  }

  function completeRequest(details) {
    for (const record of recordForRequest(details)) {
      record.statusCode = details.statusCode;
      record.completedAt = details.timeStamp || Date.now();
      record.durationMs = Math.max(0, record.completedAt - record.startedAt);
    }
    requestRecords.delete(details.requestId);
  }

  function installListeners() {
    if (listenersInstalled || !browser.webRequest) return;
    browser.webRequest.onBeforeRequest.addListener(captureRequest, { urls: ["<all_urls>"] }, ["blocking", "requestBody"]);
    browser.webRequest.onBeforeSendHeaders.addListener(captureRequestHeaders, { urls: ["<all_urls>"] }, ["requestHeaders"]);
    browser.webRequest.onHeadersReceived.addListener(captureResponseHeaders, { urls: ["<all_urls>"] }, ["responseHeaders"]);
    browser.webRequest.onCompleted.addListener(completeRequest, { urls: ["<all_urls>"] });
    browser.webRequest.onErrorOccurred.addListener((details) => {
      for (const record of recordForRequest(details)) { record.error = details.error; record.completedAt = details.timeStamp || Date.now(); }
      requestRecords.delete(details.requestId);
    }, { urls: ["<all_urls>"] });
    listenersInstalled = true;
  }

  function stopSession(id) {
    const session = sessions.get(id);
    if (!session) return { success: true, removedRecordCount: 0 };
    clearTimeout(session.timer);
    sessions.delete(id);
    for (const record of session.records) {
      const owners = requestRecords.get(record.requestId)?.filter((owner) => owner !== id);
      if (owners?.length) requestRecords.set(record.requestId, owners);
      else requestRecords.delete(record.requestId);
    }
    for (const [ruleId, rule] of replayRules) if (rule.sessionId === id) replayRules.delete(ruleId);
    return { success: true, removedRecordCount: session.records.length };
  }

  async function start(args, context) {
    if (!Number.isInteger(args?.tabId) || args.tabId < 0) throw new Error("tabId is required and must be a non-negative integer");
    await browser.tabs.get(args.tabId);
    if (!browser.webRequest) throw new Error("Firefox webRequest API is unavailable");
    installListeners();
    const id = newId();
    const startedAt = Date.now();
    const session = { id, ownerSessionId: context?.sessionId || "legacy-session", tabId: args.tabId, startedAt, expiresAt: startedAt + MAX_SESSION_MS, records: [] };
    session.timer = setTimeout(() => stopSession(id), MAX_SESSION_MS);
    sessions.set(id, session);
    return { networkSessionId: id, tabId: args.tabId, startedAt: new Date(startedAt).toISOString(), expiresAt: new Date(session.expiresAt).toISOString(), limits: { records: MAX_RECORDS, bodyBytes: MAX_BODY_BYTES } };
  }

  async function stop(args, context) {
    const session = sessionFor(args, context);
    return stopSession(session.id);
  }

  async function list(args, context) {
    const session = sessionFor(args, context);
    const category = String(args.category || "").toLowerCase();
    const urlKeyword = String(args.urlKeyword || "").toLowerCase();
    const pageKeyword = String(args.pageKeyword || "").toLowerCase();
    const method = String(args.method || "").toUpperCase();
    const records = session.records.filter((record) =>
      (!category || record.type.toLowerCase() === category) &&
      (!urlKeyword || record.url.toLowerCase().includes(urlKeyword)) &&
      (!pageKeyword || record.documentUrl.toLowerCase().includes(pageKeyword)) &&
      (!method || record.method.toUpperCase() === method) &&
      (args.statusCode === undefined || record.statusCode === args.statusCode)
    );
    const offset = Math.max(0, Number(args.offset) || 0);
    const limit = Math.min(100, Math.max(1, Number(args.limit) || 50));
    return { networkSessionId: session.id, tabId: session.tabId, total: records.length, offset, limit, records: await Promise.all(records.slice(offset, offset + limit).map(async (record) => {
      await record.responseBodyReady;
      return {
      id: record.id, url: record.url, method: record.method, type: record.type,
      documentUrl: record.documentUrl, statusCode: record.statusCode,
      startedAt: record.startedAt, completedAt: record.completedAt, durationMs: record.durationMs,
      requestBodyState: record.requestBodyState, responseBodyState: record.responseBodyState,
      responseSize: record.responseSize, error: record.error,
      requestHeaders: await publicHeaders(record.requestHeaders), responseHeaders: await publicHeaders(record.responseHeaders),
      };
    })) };
  }

  async function getRecord(args, context, side) {
    const session = sessionFor(args, context);
    const record = session.records.find((item) => item.id === args.recordId);
    if (!record) throw new Error(`Network record not found: ${args.recordId}`);
    await record.responseBodyReady;
    if (side === "request") return {
      id: record.id, url: record.url, method: record.method, type: record.type,
      documentUrl: record.documentUrl, headers: await publicHeaders(record.requestHeaders),
      body: record.requestBody, bodyState: record.requestBodyState,
    };
    return {
      id: record.id, url: record.url, statusCode: record.statusCode,
      statusLine: record.statusLine, headers: await publicHeaders(record.responseHeaders),
      bodyBase64: record.responseBody, bodyState: record.responseBodyState,
      size: record.responseSize, error: record.error,
    };
  }

  function safeReplayHeaders(headers = []) {
    return headers.filter((header) => !SENSITIVE_HEADERS.has(String(header.name).toLowerCase()));
  }

  async function replay(args, context, withOverride = false) {
    const session = sessionFor(args, context);
    const record = session.records.find((item) => item.id === args.recordId);
    if (!record) throw new Error(`Network record not found: ${args.recordId}`);
    const url = new URL(record.url);
    if (!["http:", "https:"].includes(url.protocol)) throw new Error("Only HTTP(S) requests can be replayed");
    if (withOverride) {
      const override = args.responseOverride;
      if (!override || typeof override.body !== "string") throw new Error("responseOverride.body is required");
      const forbidden = new Set(["set-cookie", "set-cookie2", "content-length", "transfer-encoding", "connection", "content-security-policy", "location"]);
      const headers = (override.headers || []).filter((item) => !forbidden.has(String(item.name).toLowerCase()) && !SENSITIVE_HEADERS.has(String(item.name).toLowerCase()));
      const ruleId = newId();
      replayRules.set(ruleId, {
        id: ruleId, sessionId: session.id, tabId: session.tabId,
        url: record.url, method: record.method, statusCode: override.status || record.statusCode || 200,
        headers, body: override.body, expiresAt: Date.now() + 10000,
      });
      // Firefox webRequest cannot synthesize a response body without canceling the page request.
      // Use the extension fetch path to perform the request and return the supplied override as a replay result.
      try {
        const result = await performReplay(record, { ...args, responseOverride: { ...override, headers } }, true);
        return { ...result, responseOverridden: true, replayRuleId: ruleId, warning: "The override is returned as replay output; Firefox WebExtensions cannot replace a live page response body without canceling its request." };
      } finally {
        replayRules.delete(ruleId);
      }
    }
    return performReplay(record, args, false);
  }

  async function performReplay(record, args, withOverride) {
    const method = String(args.methodOverride || record.method).toUpperCase();
    const headers = new Headers();
    for (const header of safeReplayHeaders(record.requestHeaders)) {
      if (header.name.toLowerCase() === "host" || header.name.toLowerCase() === "content-length") continue;
      try { headers.set(header.name, header.value); } catch {}
    }
    for (const header of args.headerOverrides || []) {
      if (SENSITIVE_HEADERS.has(String(header.name).toLowerCase())) continue;
      headers.set(header.name, header.value);
    }
    let body;
    const sourceBody = args.bodyOverride !== undefined ? args.bodyOverride : record.requestBody;
    if (!["GET", "HEAD"].includes(method) && sourceBody?.kind === "base64") {
      body = Uint8Array.from(atob(sourceBody.value), (char) => char.charCodeAt(0));
    } else if (!["GET", "HEAD"].includes(method) && typeof sourceBody === "string") body = sourceBody;
    // Cookie is a forbidden request header. The browser owns its value and
    // applies the matching cookie jar when credentials are included; the
    // cookies API check makes that behavior explicit without exposing values.
    const browserCookieCount = browser.cookies?.getAll
      ? (await browser.cookies.getAll({ url: record.url })).length
      : undefined;
    const response = await fetch(record.url, { method, headers, body, credentials: "include", redirect: "follow" });
    const filter = await activeCookieFilter();
    const responseHeaders = [...response.headers.entries()].filter(([name]) => !filter || !SENSITIVE_HEADERS.has(name.toLowerCase())).map(([name, value]) => ({ name, value }));
    let resultBody = await response.text();
    let status = response.status;
    let outputHeaders = responseHeaders;
    if (withOverride) {
      resultBody = args.responseOverride.body;
      status = args.responseOverride.status || status;
      const safeOverrideHeaders = (args.responseOverride.headers || []).filter((item) => !SENSITIVE_HEADERS.has(String(item.name).toLowerCase()));
      outputHeaders = responseHeaders.filter((item) => !safeOverrideHeaders.some((override) => override.name.toLowerCase() === item.name.toLowerCase())).concat(safeOverrideHeaders);
    }
    return { replayRecordId: newId(), url: response.url, status, headers: outputHeaders, body: resultBody, cookieMode: "browser-managed", browserCookieCount };
  }

  function removeTab(tabId) {
    for (const session of [...sessions.values()]) if (session.tabId === tabId) stopSession(session.id);
  }

  function cleanupOwner(ownerSessionId) {
    for (const session of [...sessions.values()]) if (session.ownerSessionId === ownerSessionId) stopSession(session.id);
  }

  globalThis.zenNetworkCapture = { start, stop, list, getRequest: (args, context) => getRecord(args, context, "request"), getResponse: (args, context) => getRecord(args, context, "response"), replay, replayWithResponse: (args, context) => replay(args, context, true), removeTab, cleanupOwner };
})();
