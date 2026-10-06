package main

import (
	"context"
	"embed"
	"encoding/json"
	"flag"
	"io"
	"io/fs"
	"log"
	"net/http"
	"os"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/gorilla/websocket"
)

const defaultPort = "9222"

const defaultHTTPTimeout = 30 * time.Second

const defaultSessionIdleTimeout = 10 * time.Minute

const defaultSwitchLockTimeout = 30 * time.Second

//go:embed static/*
var staticFiles embed.FS

type Bridge struct {
	mu                 sync.Mutex
	extension          *safeConn
	externals          map[*safeConn]struct{}
	pending            map[string]pendingRequest
	sessions           map[string]*bridgeSession
	cleanup            map[string]struct{}
	nextID             uint64
	nextSession        uint64
	httpTimeout        time.Duration
	sessionIdleTimeout time.Duration
	switchLockTimeout  time.Duration
	upgrader           websocket.Upgrader
}

type pendingRequest struct {
	target     responseTarget
	originalID json.RawMessage
	sessionID  string
}

type bridgeSession struct {
	id           string
	connected    bool
	lastActivity time.Time
	inFlight     int
	timer        *time.Timer
}

type responseTarget interface {
	respond([]byte) error
	matchesExternal(*safeConn) bool
}

type websocketTarget struct {
	client *safeConn
}

func (t websocketTarget) respond(data []byte) error {
	return t.client.WriteMessage(websocket.TextMessage, data)
}

func (t websocketTarget) matchesExternal(conn *safeConn) bool {
	return t.client == conn
}

type httpTarget struct {
	response chan httpResponse
}

func (t httpTarget) respond(data []byte) error {
	return t.respondHTTP(httpResponse{status: http.StatusOK, body: data})
}

func (t httpTarget) respondHTTP(response httpResponse) error {
	select {
	case t.response <- response:
	default:
	}
	return nil
}

func (t httpTarget) matchesExternal(*safeConn) bool {
	return false
}

type noopTarget struct{}

func (noopTarget) respond([]byte) error { return nil }

func (noopTarget) matchesExternal(*safeConn) bool { return false }

type forwardResult struct {
	internalID       string
	extensionPresent bool
	forwarded        bool
	err              error
}

type httpResponse struct {
	status int
	body   []byte
}

type safeConn struct {
	mu        sync.Mutex
	conn      *websocket.Conn
	sessionID string
}

func newSafeConn(conn *websocket.Conn) *safeConn {
	return &safeConn{conn: conn}
}

func (c *safeConn) ReadMessage() (int, []byte, error) {
	return c.conn.ReadMessage()
}

func (c *safeConn) WriteMessage(messageType int, data []byte) error {
	c.mu.Lock()
	defer c.mu.Unlock()
	return c.conn.WriteMessage(messageType, data)
}

func (c *safeConn) WriteJSON(v any) error {
	c.mu.Lock()
	defer c.mu.Unlock()
	return c.conn.WriteJSON(v)
}

func (c *safeConn) Close() error {
	return c.conn.Close()
}

func NewBridge() *Bridge {
	return newBridge(bridgeConfig{})
}

func newBridge(config bridgeConfig) *Bridge {
	return &Bridge{
		externals:          make(map[*safeConn]struct{}),
		pending:            make(map[string]pendingRequest),
		sessions:           make(map[string]*bridgeSession),
		cleanup:            make(map[string]struct{}),
		httpTimeout:        durationFromConfig(config.HTTPTimeout, "ZEN_MCP_HTTP_TIMEOUT", defaultHTTPTimeout),
		sessionIdleTimeout: durationFromConfig(config.SessionIdleTimeout, "ZEN_MCP_SESSION_IDLE_TIMEOUT", defaultSessionIdleTimeout),
		switchLockTimeout:  durationFromConfig(config.SwitchLockTimeout, "ZEN_MCP_SWITCH_LOCK_TIMEOUT", defaultSwitchLockTimeout),
		upgrader: websocket.Upgrader{
			CheckOrigin: func(r *http.Request) bool { return true },
		},
	}
}

func (b *Bridge) Routes() http.Handler {
	mux := http.NewServeMux()
	mux.HandleFunc("/ws", b.handleWS)
	mux.HandleFunc("/mcp", b.handleMCPHTTP)
	staticRoot, err := fs.Sub(staticFiles, "static")
	if err != nil {
		panic(err)
	}
	fileServer := http.FileServer(http.FS(staticRoot))
	mux.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		if websocket.IsWebSocketUpgrade(r) {
			b.handleWS(w, r)
			return
		}
		fileServer.ServeHTTP(w, r)
	})
	return mux
}

func (b *Bridge) handleWS(w http.ResponseWriter, r *http.Request) {
	ws, err := b.upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Printf("websocket upgrade failed: %v", err)
		return
	}
	conn := newSafeConn(ws)

	if r.URL.Query().Get("type") == "extension" {
		b.registerExtension(conn)
		b.readExtension(conn)
		return
	}

	b.registerExternal(conn)
	b.readExternal(conn)
}

func (b *Bridge) registerExtension(conn *safeConn) {
	old, pending := b.replaceExtension(conn)
	b.notifyPendingHTTPRequests(pending, http.StatusServiceUnavailable, -32000, "Extension not connected")

	if old != nil {
		log.Print("Extension reconnected, closing old connection")
		old.Close()
	}
	log.Print("Extension connected")
}

func (b *Bridge) readExtension(conn *safeConn) {
	defer func() {
		pending := b.disconnectExtension(conn)
		b.notifyPendingHTTPRequests(pending, http.StatusServiceUnavailable, -32000, "Extension not connected")
		conn.Close()
		log.Print("Extension disconnected")
	}()

	for {
		messageType, data, err := conn.ReadMessage()
		if err != nil {
			log.Printf("Extension WebSocket closed: %v", err)
			return
		}
		if messageType == websocket.TextMessage {
			b.forwardFromExtension(data)
		}
	}
}

func (b *Bridge) registerExternal(conn *safeConn) {
	b.mu.Lock()
	conn.sessionID = b.newSessionIDLocked()
	b.sessions[conn.sessionID] = &bridgeSession{id: conn.sessionID, connected: true, lastActivity: time.Now()}
	b.externals[conn] = struct{}{}
	count := len(b.externals)
	b.mu.Unlock()
	log.Printf("External client connected. Total: %d", count)
}

func (b *Bridge) readExternal(conn *safeConn) {
	defer func() {
		b.mu.Lock()
		delete(b.externals, conn)
		b.removePendingForExternalLocked(conn)
		b.disconnectSessionLocked(conn.sessionID)
		count := len(b.externals)
		b.mu.Unlock()
		conn.Close()
		log.Printf("External client disconnected. Total: %d", count)
	}()

	for {
		messageType, data, err := conn.ReadMessage()
		if err != nil {
			log.Printf("External WebSocket closed: %v", err)
			return
		}
		if messageType != websocket.TextMessage {
			continue
		}
		b.touchSession(conn.sessionID)
		b.forwardToExtension(conn, data)
	}
}

func (b *Bridge) handleMCPHTTP(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		w.Header().Set("Allow", http.MethodPost)
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	if !acceptsJSON(r.Header.Get("Accept")) {
		http.Error(w, "not acceptable", http.StatusNotAcceptable)
		return
	}

	// MCP clients use the standard Streamable HTTP header. Keep accepting the
	// original project-specific header for backwards compatibility with older
	// clients and installations.
	sessionID := strings.TrimSpace(r.Header.Get("MCP-Session-Id"))
	if sessionID == "" {
		sessionID = strings.TrimSpace(r.Header.Get("X-Zen-MCP-Session-ID"))
	}
	b.mu.Lock()
	if sessionID == "" {
		sessionID = b.newSessionIDLocked()
	}
	b.beginHTTPSessionLocked(sessionID)
	b.mu.Unlock()
	w.Header().Set("X-Zen-MCP-Session-ID", sessionID)
	w.Header().Set("MCP-Session-Id", sessionID)
	defer b.endHTTPSession(sessionID)

	data, err := io.ReadAll(r.Body)
	if err != nil {
		writeJSONRPCError(w, nil, http.StatusBadRequest, -32700, "Parse error")
		return
	}
	if !json.Valid(data) {
		writeJSONRPCError(w, nil, http.StatusBadRequest, -32700, "Parse error")
		return
	}
	if !isJSONObject(data) {
		writeJSONRPCError(w, nil, http.StatusBadRequest, -32700, "Parse error")
		return
	}

	var request map[string]json.RawMessage
	if err := json.Unmarshal(data, &request); err != nil {
		writeJSONRPCError(w, nil, http.StatusBadRequest, -32600, "Invalid Request")
		return
	}

	originalID, hasID := jsonMessageID(data)
	var jsonrpcValue any
	if err := json.Unmarshal(request["jsonrpc"], &jsonrpcValue); err != nil {
		writeJSONRPCError(w, originalID, http.StatusBadRequest, -32600, "Invalid Request")
		return
	}
	jsonrpc, ok := jsonrpcValue.(string)
	if !ok || jsonrpc != "2.0" {
		writeJSONRPCError(w, originalID, http.StatusBadRequest, -32600, "Invalid Request")
		return
	}
	var methodValue any
	if err := json.Unmarshal(request["method"], &methodValue); err != nil {
		writeJSONRPCError(w, originalID, http.StatusBadRequest, -32600, "Invalid Request")
		return
	}
	if _, ok := methodValue.(string); !ok {
		writeJSONRPCError(w, originalID, http.StatusBadRequest, -32600, "Invalid Request")
		return
	}

	if !hasID {
		result := b.forwardMessageToExtension(noopTarget{}, data, sessionID)
		if !result.extensionPresent {
			writeJSONRPCError(w, nil, http.StatusServiceUnavailable, -32000, "Extension not connected")
			return
		}
		if result.err != nil {
			writeJSONRPCError(w, nil, http.StatusBadGateway, -32000, "Failed to forward request to extension")
			return
		}
		w.WriteHeader(http.StatusAccepted)
		return
	}

	responseCh := make(chan httpResponse, 1)
	result := b.forwardMessageToExtension(httpTarget{response: responseCh}, data, sessionID)
	if !result.extensionPresent {
		writeJSONRPCError(w, originalID, http.StatusServiceUnavailable, -32000, "Extension not connected")
		return
	}
	if result.err != nil {
		writeJSONRPCError(w, originalID, http.StatusBadGateway, -32000, "Failed to forward request to extension")
		return
	}

	ctx, cancel := context.WithTimeout(r.Context(), b.httpTimeout)
	defer cancel()

	select {
	case response := <-responseCh:
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(response.status)
		_, _ = w.Write(response.body)
	case <-ctx.Done():
		b.removePendingRequest(result.internalID)
		writeJSONRPCError(w, originalID, http.StatusGatewayTimeout, -32000, "Extension response timed out")
	}
}

func (b *Bridge) forwardToExtension(external *safeConn, data []byte) {
	result := b.forwardMessageToExtension(websocketTarget{client: external}, data, external.sessionID)
	if !result.extensionPresent {
		if err := external.WriteJSON(extensionNotConnected(data)); err != nil {
			log.Printf("Failed to send extension missing error: %v", err)
		}
		return
	}
	if result.err != nil {
		log.Printf("Failed to forward request to extension: %v", result.err)
	}
}

func (b *Bridge) forwardMessageToExtension(target responseTarget, data []byte, sessionID string) forwardResult {
	originalID, hasID := jsonMessageID(data)
	forwardedData := data
	var internalID string
	if hasID {
		b.mu.Lock()
		b.nextID++
		internalID = strconv.Quote("bridge-" + strconv.FormatUint(b.nextID, 10))
		b.mu.Unlock()

		rewrittenData, err := rewriteJSONID(data, json.RawMessage(internalID))
		if err != nil {
			return forwardResult{err: err}
		}
		forwardedData = rewrittenData
	}

	b.mu.Lock()
	extension := b.extension
	if extension != nil && hasID {
		b.pending[internalID] = pendingRequest{target: target, originalID: originalID, sessionID: sessionID}
		if _, isHTTP := target.(httpTarget); !isHTTP {
			b.markSessionInFlightLocked(sessionID)
		}
	}
	b.mu.Unlock()

	if extension == nil {
		return forwardResult{}
	}

	forwardedData, err := decorateSessionMessage(forwardedData, sessionID, b.switchLockTimeout)
	if err != nil {
		if hasID {
			b.removePendingRequest(internalID)
		}
		return forwardResult{internalID: internalID, extensionPresent: true, err: err}
	}
	if err := extension.WriteMessage(websocket.TextMessage, forwardedData); err != nil {
		if hasID {
			b.removePendingRequest(internalID)
		}
		return forwardResult{internalID: internalID, extensionPresent: true, err: err}
	}

	return forwardResult{internalID: internalID, extensionPresent: true, forwarded: true}
}

func (b *Bridge) forwardFromExtension(data []byte) {
	id, hasID, isResponse := jsonRPCResponse(data)
	if !isResponse {
		b.broadcastToExternal(data)
		return
	}
	if !hasID {
		log.Print("Dropping JSON-RPC response without id from extension")
		return
	}

	b.mu.Lock()
	pending, ok := b.pending[id]
	if !ok {
		b.mu.Unlock()
		// Unknown responses are dropped instead of broadcast to avoid leaking tool results across clients.
		log.Printf("Dropping JSON-RPC response with unknown id from extension: %s", id)
		return
	}
	delete(b.pending, id)
	if _, isHTTP := pending.target.(httpTarget); !isHTTP {
		b.completeSessionRequestLocked(pending.sessionID)
	}
	b.mu.Unlock()
	routedData, err := rewriteJSONID(data, pending.originalID)
	if err != nil {
		log.Printf("Failed to restore original response id: %v", err)
		return
	}

	if err := pending.target.respond(routedData); err != nil {
		log.Printf("Failed to forward response to external client: %v", err)
	}
}

func (b *Bridge) removePendingRequest(id string) {
	b.mu.Lock()
	defer b.mu.Unlock()
	if pending, ok := b.pending[id]; ok {
		delete(b.pending, id)
		if _, isHTTP := pending.target.(httpTarget); !isHTTP {
			b.completeSessionRequestLocked(pending.sessionID)
		}
	}
}

func (b *Bridge) replaceExtension(conn *safeConn) (*safeConn, []pendingRequest) {
	b.mu.Lock()
	defer b.mu.Unlock()
	old := b.extension
	b.extension = conn
	cleanup := make([]string, 0, len(b.cleanup))
	for sessionID := range b.cleanup {
		cleanup = append(cleanup, sessionID)
		delete(b.cleanup, sessionID)
	}
	for _, sessionID := range cleanup {
		if err := conn.WriteJSON(map[string]any{"type": "zen/session-disconnected", "sessionId": sessionID}); err != nil {
			log.Printf("Failed to send queued session cleanup: %v", err)
		}
	}
	return old, b.takePendingLocked()
}

func (b *Bridge) disconnectExtension(conn *safeConn) []pendingRequest {
	b.mu.Lock()
	defer b.mu.Unlock()
	if b.extension != conn {
		return nil
	}
	b.extension = nil
	return b.takePendingLocked()
}

func (b *Bridge) takePendingLocked() []pendingRequest {
	if len(b.pending) == 0 {
		return nil
	}
	pending := make([]pendingRequest, 0, len(b.pending))
	for _, request := range b.pending {
		pending = append(pending, request)
		if _, isHTTP := request.target.(httpTarget); !isHTTP {
			b.completeSessionRequestLocked(request.sessionID)
		}
	}
	b.pending = make(map[string]pendingRequest)
	return pending
}

func (b *Bridge) removePendingForExternalLocked(external *safeConn) {
	for id, pending := range b.pending {
		if pending.target.matchesExternal(external) {
			delete(b.pending, id)
			b.completeSessionRequestLocked(pending.sessionID)
		}
	}
}

func (b *Bridge) newSessionIDLocked() string {
	b.nextSession++
	return "session-" + strconv.FormatInt(time.Now().UnixNano(), 10) + "-" + strconv.FormatUint(b.nextSession, 10)
}

func (b *Bridge) touchSession(sessionID string) {
	b.mu.Lock()
	defer b.mu.Unlock()
	if session, ok := b.sessions[sessionID]; ok {
		session.lastActivity = time.Now()
	}
}

func (b *Bridge) beginHTTPSessionLocked(sessionID string) {
	session, ok := b.sessions[sessionID]
	if !ok {
		session = &bridgeSession{id: sessionID}
		b.sessions[sessionID] = session
	}
	if session.timer != nil {
		session.timer.Stop()
		session.timer = nil
	}
	session.connected = false
	session.lastActivity = time.Now()
	session.inFlight++
}

func (b *Bridge) markSessionInFlightLocked(sessionID string) {
	if session, ok := b.sessions[sessionID]; ok {
		session.inFlight++
		session.lastActivity = time.Now()
	}
}

func (b *Bridge) completeSessionRequestLocked(sessionID string) {
	if session, ok := b.sessions[sessionID]; ok && session.inFlight > 0 {
		session.inFlight--
		session.lastActivity = time.Now()
		if !session.connected && session.inFlight == 0 {
			b.scheduleSessionCleanupLocked(session)
		}
	}
}

func (b *Bridge) endHTTPSession(sessionID string) {
	b.mu.Lock()
	defer b.mu.Unlock()
	b.completeSessionRequestLocked(sessionID)
}

func (b *Bridge) disconnectSessionLocked(sessionID string) {
	if session, ok := b.sessions[sessionID]; ok {
		session.connected = false
		session.lastActivity = time.Now()
		if session.inFlight == 0 {
			b.scheduleSessionCleanupLocked(session)
		}
	}
}

func (b *Bridge) scheduleSessionCleanupLocked(session *bridgeSession) {
	if session.timer != nil {
		return
	}
	session.timer = time.AfterFunc(b.sessionIdleTimeout, func() {
		b.cleanupSession(session.id)
	})
}

func (b *Bridge) cleanupSession(sessionID string) {
	b.mu.Lock()
	session, ok := b.sessions[sessionID]
	if !ok || session.connected || session.inFlight != 0 || time.Since(session.lastActivity) < b.sessionIdleTimeout {
		b.mu.Unlock()
		return
	}
	delete(b.sessions, sessionID)
	delete(b.cleanup, sessionID)
	if b.extension == nil {
		b.cleanup[sessionID] = struct{}{}
		b.mu.Unlock()
		return
	}
	extension := b.extension
	b.mu.Unlock()
	if err := extension.WriteJSON(map[string]any{"type": "zen/session-disconnected", "sessionId": sessionID}); err != nil {
		log.Printf("Failed to send session cleanup for %s: %v", sessionID, err)
		b.mu.Lock()
		b.cleanup[sessionID] = struct{}{}
		b.mu.Unlock()
	}
	log.Printf("Session %s idle cleanup dispatched", sessionID)
}

func decorateSessionMessage(data []byte, sessionID string, lockTimeout time.Duration) ([]byte, error) {
	var message map[string]json.RawMessage
	if err := json.Unmarshal(data, &message); err != nil {
		// External WebSocket clients historically may send non-JSON payloads.
		// Preserve that compatibility path; only JSON-RPC messages receive
		// session metadata.
		return data, nil
	}
	sessionValue, err := json.Marshal(sessionID)
	if err != nil {
		return nil, err
	}
	lockValue, err := json.Marshal(lockTimeout.Milliseconds())
	if err != nil {
		return nil, err
	}
	message["_zenMcpSessionId"] = sessionValue
	message["_zenMcpSwitchLockTimeout"] = lockValue
	return json.Marshal(message)
}

func durationFromEnv(name string, fallback time.Duration) time.Duration {
	value := strings.TrimSpace(os.Getenv(name))
	if value == "" {
		return fallback
	}
	if duration, err := time.ParseDuration(value); err == nil && duration > 0 {
		return duration
	}
	if milliseconds, err := strconv.ParseInt(value, 10, 64); err == nil && milliseconds > 0 {
		return time.Duration(milliseconds) * time.Millisecond
	}
	log.Printf("Invalid %s=%q; using %s", name, value, fallback)
	return fallback
}

func (b *Bridge) notifyPendingHTTPRequests(pending []pendingRequest, status int, code int, message string) {
	for _, request := range pending {
		target, ok := request.target.(httpTarget)
		if !ok {
			continue
		}
		body := mustJSONRPCErrorBody(request.originalID, code, message)
		_ = target.respondHTTP(httpResponse{status: status, body: body})
	}
}

func (b *Bridge) broadcastToExternal(data []byte) {
	b.mu.Lock()
	clients := make([]*safeConn, 0, len(b.externals))
	for client := range b.externals {
		clients = append(clients, client)
	}
	b.mu.Unlock()

	for _, client := range clients {
		if err := client.WriteMessage(websocket.TextMessage, data); err != nil {
			log.Printf("Failed to forward response to external client: %v", err)
		}
	}
}

func extensionNotConnected(data []byte) map[string]any {
	var request struct {
		ID json.RawMessage `json:"id"`
	}
	_ = json.Unmarshal(data, &request)

	return map[string]any{
		"jsonrpc": "2.0",
		"id":      request.ID,
		"error": map[string]any{
			"code":    -32000,
			"message": "Extension not connected",
		},
	}
}

func acceptsJSON(accept string) bool {
	if strings.TrimSpace(accept) == "" {
		return true
	}
	for _, part := range strings.Split(accept, ",") {
		mediaType := strings.ToLower(strings.TrimSpace(strings.Split(part, ";")[0]))
		if mediaType == "application/json" || mediaType == "*/*" || mediaType == "application/*" {
			return true
		}
	}
	return false
}

func writeJSONRPCError(w http.ResponseWriter, id json.RawMessage, status int, code int, message string) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_, _ = w.Write(mustJSONRPCErrorBody(id, code, message))
}

func mustJSONRPCErrorBody(id json.RawMessage, code int, message string) []byte {
	response := map[string]any{
		"jsonrpc": "2.0",
		"id":      id,
		"error": map[string]any{
			"code":    code,
			"message": message,
		},
	}
	body, err := json.Marshal(response)
	if err != nil {
		panic(err)
	}
	return body
}

func isJSONObject(data []byte) bool {
	trimmed := strings.TrimSpace(string(data))
	return strings.HasPrefix(trimmed, "{") && strings.HasSuffix(trimmed, "}")
}

func jsonMessageID(data []byte) (json.RawMessage, bool) {
	var message map[string]json.RawMessage
	if err := json.Unmarshal(data, &message); err != nil {
		return nil, false
	}
	id, ok := message["id"]
	if !ok {
		return nil, false
	}
	return id, true
}

func jsonRPCResponse(data []byte) (string, bool, bool) {
	var message map[string]json.RawMessage
	if err := json.Unmarshal(data, &message); err != nil {
		return "", false, false
	}
	_, hasResult := message["result"]
	_, hasError := message["error"]
	if !hasResult && !hasError {
		return "", false, false
	}
	id, hasID := message["id"]
	return string(id), hasID, true
}

func rewriteJSONID(data []byte, id json.RawMessage) ([]byte, error) {
	var message map[string]json.RawMessage
	if err := json.Unmarshal(data, &message); err != nil {
		return nil, err
	}
	message["id"] = id
	return json.Marshal(message)
}

func main() {
	configPath := flag.String("config", os.Getenv("ZEN_MCP_CONFIG"), "path to the bridge JSON configuration")
	flag.Parse()
	config, err := loadBridgeConfig(*configPath)
	if err != nil {
		log.Fatalf("zen-mcp bridge configuration failed: %v", err)
	}
	port := configuredPort(config.Port)

	bridge := newBridge(config)
	log.Printf("zen-mcp bridge server listening on port %s", port)
	if err := http.ListenAndServe(":"+port, bridge.Routes()); err != nil {
		log.Fatalf("zen-mcp bridge server failed: %v", err)
	}
}
