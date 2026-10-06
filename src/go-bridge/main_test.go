package main

import (
	"bytes"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/gorilla/websocket"
)

func TestExternalRequestWithoutExtensionReturnsError(t *testing.T) {
	server := newTestServer(t)
	client := dialWS(t, server, "/ws")
	defer client.Close()

	request := `{"jsonrpc":"2.0","id":"req-1","method":"tabs/list"}`
	if err := client.WriteMessage(websocket.TextMessage, []byte(request)); err != nil {
		t.Fatalf("write request: %v", err)
	}

	_, data, err := client.ReadMessage()
	if err != nil {
		t.Fatalf("read response: %v", err)
	}

	var response struct {
		JSONRPC string          `json:"jsonrpc"`
		ID      json.RawMessage `json:"id"`
		Error   struct {
			Code    int    `json:"code"`
			Message string `json:"message"`
		} `json:"error"`
	}
	if err := json.Unmarshal(data, &response); err != nil {
		t.Fatalf("decode response %q: %v", string(data), err)
	}

	if response.JSONRPC != "2.0" {
		t.Fatalf("jsonrpc = %q, want 2.0", response.JSONRPC)
	}
	if string(response.ID) != `"req-1"` {
		t.Fatalf("id = %s, want %q", response.ID, `"req-1"`)
	}
	if response.Error.Code != -32000 {
		t.Fatalf("error code = %d, want -32000", response.Error.Code)
	}
	if response.Error.Message != "Extension not connected" {
		t.Fatalf("error message = %q", response.Error.Message)
	}
}

func TestLoadBridgeConfigAndEnvironmentOverrides(t *testing.T) {
	configPath := filepath.Join(t.TempDir(), "config.json")
	if err := os.WriteFile(configPath, []byte(`{
  "port": "9333",
  "httpTimeout": "2s",
  "sessionIdleTimeout": "4m",
  "switchLockTimeout": "5s"
}`), 0o644); err != nil {
		t.Fatalf("write config: %v", err)
	}

	t.Setenv("ZEN_MCP_PORT", "9444")
	t.Setenv("ZEN_MCP_HTTP_TIMEOUT", "7s")
	config, err := loadBridgeConfig(configPath)
	if err != nil {
		t.Fatalf("load config: %v", err)
	}
	if configuredPort(config.Port) != "9444" {
		t.Fatalf("port override = %q, want 9444", configuredPort(config.Port))
	}
	if got := durationFromConfig(config.HTTPTimeout, "ZEN_MCP_HTTP_TIMEOUT", time.Second); got != 7*time.Second {
		t.Fatalf("HTTP timeout = %s, want 7s", got)
	}
	if got := durationFromConfig(config.SessionIdleTimeout, "ZEN_MCP_SESSION_IDLE_TIMEOUT", time.Second); got != 4*time.Minute {
		t.Fatalf("session timeout = %s, want 4m", got)
	}
}

func TestRootExternalRequestWithoutExtensionReturnsError(t *testing.T) {
	server := newTestServer(t)
	client := dialWS(t, server, "/")
	defer client.Close()

	request := `{"jsonrpc":"2.0","id":"root-req","method":"tabs/list"}`
	if err := client.WriteMessage(websocket.TextMessage, []byte(request)); err != nil {
		t.Fatalf("write request: %v", err)
	}

	_, data, err := client.ReadMessage()
	if err != nil {
		t.Fatalf("read response: %v", err)
	}

	var response struct {
		ID    json.RawMessage `json:"id"`
		Error struct {
			Message string `json:"message"`
		} `json:"error"`
	}
	if err := json.Unmarshal(data, &response); err != nil {
		t.Fatalf("decode response %q: %v", string(data), err)
	}
	if string(response.ID) != `"root-req"` {
		t.Fatalf("id = %s, want %q", response.ID, `"root-req"`)
	}
	if response.Error.Message != "Extension not connected" {
		t.Fatalf("error message = %q", response.Error.Message)
	}
}

func TestRootExternalMessageForwardsToRootExtension(t *testing.T) {
	server := newTestServer(t)
	extension := dialWS(t, server, "/?type=extension")
	defer extension.Close()
	external := dialWS(t, server, "/")
	defer external.Close()

	request := `{"jsonrpc":"2.0","id":4,"method":"tabs/list"}`
	if err := external.WriteMessage(websocket.TextMessage, []byte(request)); err != nil {
		t.Fatalf("write request: %v", err)
	}

	_, data, err := extension.ReadMessage()
	if err != nil {
		t.Fatalf("read forwarded request: %v", err)
	}
	requireForwardedMethod(t, data, "tabs/list")
}

func TestExternalMessageForwardsToExtension(t *testing.T) {
	server := newTestServer(t)
	extension := dialWS(t, server, "/ws?type=extension")
	defer extension.Close()
	external := dialWS(t, server, "/ws")
	defer external.Close()

	request := `{"jsonrpc":"2.0","id":2,"method":"tabs/list"}`
	if err := external.WriteMessage(websocket.TextMessage, []byte(request)); err != nil {
		t.Fatalf("write request: %v", err)
	}

	_, data, err := extension.ReadMessage()
	if err != nil {
		t.Fatalf("read forwarded request: %v", err)
	}
	requireForwardedMethod(t, data, "tabs/list")
}

func TestExtensionMessageForwardsToExternalClient(t *testing.T) {
	server := newTestServer(t)
	extension := dialWS(t, server, "/ws?type=extension")
	defer extension.Close()
	external := dialWS(t, server, "/ws")
	defer external.Close()

	request := `{"jsonrpc":"2.0","id":2,"method":"tabs/list"}`
	if err := external.WriteMessage(websocket.TextMessage, []byte(request)); err != nil {
		t.Fatalf("write request: %v", err)
	}
	_, forwardedRequest, err := extension.ReadMessage()
	if err != nil {
		t.Fatalf("read forwarded request: %v", err)
	}
	forwardedID := requireJSONID(t, forwardedRequest)

	response := `{"jsonrpc":"2.0","id":` + string(forwardedID) + `,"result":{"ok":true}}`
	if err := extension.WriteMessage(websocket.TextMessage, []byte(response)); err != nil {
		t.Fatalf("write response: %v", err)
	}

	_, data, err := external.ReadMessage()
	if err != nil {
		t.Fatalf("read forwarded response: %v", err)
	}
	requireRoutedResponseID(t, data, "2")
}

func TestExtensionResponseRoutesOnlyToOriginatingClientWithSameID(t *testing.T) {
	server := newTestServer(t)
	extension := dialWS(t, server, "/ws?type=extension")
	defer extension.Close()
	origin := dialWS(t, server, "/ws")
	defer origin.Close()
	other := dialWS(t, server, "/ws")
	defer other.Close()

	request := `{"jsonrpc":"2.0","id":"same-id","method":"tabs/list"}`
	if err := origin.WriteMessage(websocket.TextMessage, []byte(request)); err != nil {
		t.Fatalf("write origin request: %v", err)
	}
	_, forwardedRequest, err := extension.ReadMessage()
	if err != nil {
		t.Fatalf("read forwarded request: %v", err)
	}
	forwardedID := requireJSONID(t, forwardedRequest)

	response := `{"jsonrpc":"2.0","id":` + string(forwardedID) + `,"result":{"ok":true}}`
	if err := extension.WriteMessage(websocket.TextMessage, []byte(response)); err != nil {
		t.Fatalf("write response: %v", err)
	}

	_, data, err := origin.ReadMessage()
	if err != nil {
		t.Fatalf("origin read response: %v", err)
	}
	requireRoutedResponseID(t, data, `"same-id"`)
	if _, _, err := other.ReadMessage(); err == nil {
		t.Fatal("other client received origin response")
	}
}

func TestExtensionResponsesWithDuplicateOriginalIDsRouteOutOfOrder(t *testing.T) {
	server := newTestServer(t)
	extension := dialWS(t, server, "/ws?type=extension")
	defer extension.Close()
	first := dialWS(t, server, "/ws")
	defer first.Close()
	second := dialWS(t, server, "/ws")
	defer second.Close()

	firstRequest := `{"jsonrpc":"2.0","id":7,"method":"tabs/list"}`
	if err := first.WriteMessage(websocket.TextMessage, []byte(firstRequest)); err != nil {
		t.Fatalf("write first request: %v", err)
	}
	_, firstForwarded, err := extension.ReadMessage()
	if err != nil {
		t.Fatalf("read first forwarded request: %v", err)
	}
	firstInternalID := requireJSONID(t, firstForwarded)
	if string(firstInternalID) == "7" {
		t.Fatalf("first forwarded id = %s, want internal id", firstInternalID)
	}

	secondRequest := `{"jsonrpc":"2.0","id":7,"method":"tabs/list"}`
	if err := second.WriteMessage(websocket.TextMessage, []byte(secondRequest)); err != nil {
		t.Fatalf("write second request: %v", err)
	}
	_, secondForwarded, err := extension.ReadMessage()
	if err != nil {
		t.Fatalf("read second forwarded request: %v", err)
	}
	secondInternalID := requireJSONID(t, secondForwarded)
	if string(secondInternalID) == "7" {
		t.Fatalf("second forwarded id = %s, want internal id", secondInternalID)
	}
	if bytes.Equal(firstInternalID, secondInternalID) {
		t.Fatalf("forwarded ids are both %s, want unique internal ids", firstInternalID)
	}

	secondResponse := `{"jsonrpc":"2.0","id":` + string(secondInternalID) + `,"result":{"client":"second"}}`
	if err := extension.WriteMessage(websocket.TextMessage, []byte(secondResponse)); err != nil {
		t.Fatalf("write second response: %v", err)
	}
	_, data, err := second.ReadMessage()
	if err != nil {
		t.Fatalf("second read response: %v", err)
	}
	requireRoutedResponse(t, data, "7", "second")

	firstResponse := `{"jsonrpc":"2.0","id":` + string(firstInternalID) + `,"result":{"client":"first"}}`
	if err := extension.WriteMessage(websocket.TextMessage, []byte(firstResponse)); err != nil {
		t.Fatalf("write first response: %v", err)
	}
	_, data, err = first.ReadMessage()
	if err != nil {
		t.Fatalf("first read response: %v", err)
	}
	requireRoutedResponse(t, data, "7", "first")
	requireNoMessage(t, first, "first client received an extra response")
	requireNoMessage(t, second, "second client received first response")
}

func TestNewExtensionReplacesOldExtension(t *testing.T) {
	server := newTestServer(t)
	oldExtension := dialWS(t, server, "/ws?type=extension")
	defer oldExtension.Close()
	newExtension := dialWS(t, server, "/ws?type=extension")
	defer newExtension.Close()
	external := dialWS(t, server, "/ws")
	defer external.Close()

	request := `{"jsonrpc":"2.0","id":3,"method":"tabs/list"}`
	if err := external.WriteMessage(websocket.TextMessage, []byte(request)); err != nil {
		t.Fatalf("write request: %v", err)
	}

	_, data, err := newExtension.ReadMessage()
	if err != nil {
		t.Fatalf("read forwarded request from new extension: %v", err)
	}
	requireForwardedMethod(t, data, "tabs/list")

	if _, _, err := oldExtension.ReadMessage(); err == nil {
		t.Fatal("old extension remained open after replacement")
	}
}

func TestConcurrentExternalMessagesSerializeWritesToExtension(t *testing.T) {
	server := newTestServer(t)
	extension := dialWS(t, server, "/ws?type=extension")
	defer extension.Close()

	const clients = 20
	externals := make([]*websocket.Conn, 0, clients)
	for i := 0; i < clients; i++ {
		client := dialWS(t, server, "/ws")
		defer client.Close()
		externals = append(externals, client)
	}

	var wg sync.WaitGroup
	for i, client := range externals {
		wg.Add(1)
		go func(i int, client *websocket.Conn) {
			defer wg.Done()
			request := []byte(`{"jsonrpc":"2.0","id":` + string(rune('A'+i)) + `,"method":"tabs/list"}`)
			_ = client.WriteMessage(websocket.TextMessage, request)
		}(i, client)
	}
	wg.Wait()

	for i := 0; i < clients; i++ {
		if _, _, err := extension.ReadMessage(); err != nil {
			t.Fatalf("read forwarded request %d: %v", i, err)
		}
	}
}

func TestHTTPMCPRequestWithoutExtensionReturnsError(t *testing.T) {
	server := newTestServer(t)

	result := requireHTTPMCPResult(t, postMCP(t, server, `{"jsonrpc":"2.0","id":"http-req","method":"tools/list"}`))
	if result.status != http.StatusServiceUnavailable {
		t.Fatalf("status = %d, want %d; body = %s", result.status, http.StatusServiceUnavailable, result.body)
	}

	var decoded struct {
		ID    json.RawMessage `json:"id"`
		Error struct {
			Code    int    `json:"code"`
			Message string `json:"message"`
		} `json:"error"`
	}
	if err := json.Unmarshal(result.body, &decoded); err != nil {
		t.Fatalf("decode response %q: %v", string(result.body), err)
	}
	if string(decoded.ID) != `"http-req"` {
		t.Fatalf("id = %s, want %q", decoded.ID, `"http-req"`)
	}
	if decoded.Error.Code != -32000 || decoded.Error.Message != "Extension not connected" {
		t.Fatalf("error = %+v, want extension not connected", decoded.Error)
	}
}

func TestHTTPMCPRequestForwardsToExtensionAndRestoresID(t *testing.T) {
	server := newTestServer(t)
	extension := dialWS(t, server, "/ws?type=extension")
	defer extension.Close()

	responseCh := make(chan httpMCPResult, 1)
	go func() {
		responseCh <- postMCP(t, server, `{"jsonrpc":"2.0","id":"http-original","method":"tools/list"}`)
	}()

	_, forwarded, err := extension.ReadMessage()
	if err != nil {
		t.Fatalf("read forwarded request: %v", err)
	}
	requireForwardedMethod(t, forwarded, "tools/list")
	forwardedID := requireJSONID(t, forwarded)
	if string(forwardedID) == `"http-original"` {
		t.Fatalf("forwarded id = %s, want bridge id", forwardedID)
	}

	extensionResponse := `{"jsonrpc":"2.0","id":` + string(forwardedID) + `,"result":{"ok":true}}`
	if err := extension.WriteMessage(websocket.TextMessage, []byte(extensionResponse)); err != nil {
		t.Fatalf("write extension response: %v", err)
	}

	result := receiveHTTPMCPResult(t, responseCh)
	if result.status != http.StatusOK {
		t.Fatalf("status = %d, want %d; body = %s", result.status, http.StatusOK, result.body)
	}
	requireRoutedResponseID(t, result.body, `"http-original"`)
}

func TestHTTPMCPUsesStandardSessionHeaderAcrossRequests(t *testing.T) {
	server := newTestServer(t)
	extension := dialWS(t, server, "/ws?type=extension")
	defer extension.Close()

	firstCh := make(chan httpMCPResult, 1)
	go func() {
		firstCh <- postMCPWithHeaders(t, server, `{"jsonrpc":"2.0","id":"first","method":"tools/list"}`, nil)
	}()
	_, firstForwarded, err := extension.ReadMessage()
	if err != nil {
		t.Fatalf("read first forwarded request: %v", err)
	}
	firstID := requireJSONID(t, firstForwarded)
	if err := extension.WriteMessage(websocket.TextMessage, []byte(`{"jsonrpc":"2.0","id":`+string(firstID)+`,"result":{}}`)); err != nil {
		t.Fatalf("write first response: %v", err)
	}
	firstResult := receiveHTTPMCPResult(t, firstCh)
	firstSessionID := firstResult.headers.Get("MCP-Session-Id")
	if firstSessionID == "" {
		t.Fatal("first response did not return MCP-Session-Id")
	}
	if firstSessionID != firstResult.headers.Get("X-Zen-MCP-Session-ID") {
		t.Fatal("standard and legacy session headers differ")
	}

	secondCh := make(chan httpMCPResult, 1)
	go func() {
		secondCh <- postMCPWithHeaders(t, server, `{"jsonrpc":"2.0","id":"second","method":"tools/list"}`, map[string]string{"MCP-Session-Id": firstSessionID})
	}()
	_, secondForwarded, err := extension.ReadMessage()
	if err != nil {
		t.Fatalf("read second forwarded request: %v", err)
	}
	secondID := requireJSONID(t, secondForwarded)
	if err := extension.WriteMessage(websocket.TextMessage, []byte(`{"jsonrpc":"2.0","id":`+string(secondID)+`,"result":{}}`)); err != nil {
		t.Fatalf("write second response: %v", err)
	}
	secondResult := receiveHTTPMCPResult(t, secondCh)
	if secondResult.headers.Get("MCP-Session-Id") != firstSessionID {
		t.Fatalf("session id changed from %q to %q", firstSessionID, secondResult.headers.Get("MCP-Session-Id"))
	}
}

func TestHTTPMCPDuplicateOriginalIDsRouteOutOfOrder(t *testing.T) {
	server := newTestServer(t)
	extension := dialWS(t, server, "/ws?type=extension")
	defer extension.Close()

	firstCh := make(chan httpMCPResult, 1)
	secondCh := make(chan httpMCPResult, 1)
	go func() {
		firstCh <- postMCP(t, server, `{"jsonrpc":"2.0","id":7,"method":"tools/list"}`)
	}()
	_, firstForwarded, err := extension.ReadMessage()
	if err != nil {
		t.Fatalf("read first forwarded request: %v", err)
	}
	firstID := requireJSONID(t, firstForwarded)

	go func() {
		secondCh <- postMCP(t, server, `{"jsonrpc":"2.0","id":7,"method":"tools/list"}`)
	}()
	_, secondForwarded, err := extension.ReadMessage()
	if err != nil {
		t.Fatalf("read second forwarded request: %v", err)
	}
	secondID := requireJSONID(t, secondForwarded)

	if bytes.Equal(firstID, secondID) {
		t.Fatalf("forwarded ids are both %s, want unique ids", firstID)
	}

	if err := extension.WriteMessage(websocket.TextMessage, []byte(`{"jsonrpc":"2.0","id":`+string(secondID)+`,"result":{"client":"second"}}`)); err != nil {
		t.Fatalf("write second response: %v", err)
	}
	secondResult := receiveHTTPMCPResult(t, secondCh)
	if secondResult.status != http.StatusOK {
		t.Fatalf("second status = %d, want %d; body = %s", secondResult.status, http.StatusOK, secondResult.body)
	}
	requireRoutedResponse(t, secondResult.body, "7", "second")

	if err := extension.WriteMessage(websocket.TextMessage, []byte(`{"jsonrpc":"2.0","id":`+string(firstID)+`,"result":{"client":"first"}}`)); err != nil {
		t.Fatalf("write first response: %v", err)
	}
	firstResult := receiveHTTPMCPResult(t, firstCh)
	if firstResult.status != http.StatusOK {
		t.Fatalf("first status = %d, want %d; body = %s", firstResult.status, http.StatusOK, firstResult.body)
	}
	requireRoutedResponse(t, firstResult.body, "7", "first")
}

func TestHTTPMCPNotificationReturnsAcceptedWithoutWaiting(t *testing.T) {
	server := newTestServer(t)
	extension := dialWS(t, server, "/ws?type=extension")
	defer extension.Close()

	result := requireHTTPMCPResult(t, postMCP(t, server, `{"jsonrpc":"2.0","method":"notifications/initialized"}`))
	if result.status != http.StatusAccepted {
		t.Fatalf("status = %d, want %d; body = %s", result.status, http.StatusAccepted, result.body)
	}
	if len(result.body) != 0 {
		t.Fatalf("body = %s, want empty", result.body)
	}

	_, forwarded, err := extension.ReadMessage()
	if err != nil {
		t.Fatalf("read notification: %v", err)
	}
	requireForwardedMethod(t, forwarded, "notifications/initialized")
}

func TestHTTPMCPTimeoutRemovesPendingRequest(t *testing.T) {
	bridge := NewBridge()
	bridge.httpTimeout = 20 * time.Millisecond
	server := httptest.NewServer(bridge.Routes())
	t.Cleanup(server.Close)
	extension := dialWS(t, server, "/ws?type=extension")
	defer extension.Close()

	result := requireHTTPMCPResult(t, postMCP(t, server, `{"jsonrpc":"2.0","id":"slow","method":"tools/list"}`))
	if result.status != http.StatusGatewayTimeout {
		t.Fatalf("status = %d, want %d; body = %s", result.status, http.StatusGatewayTimeout, result.body)
	}

	bridge.mu.Lock()
	pendingCount := len(bridge.pending)
	bridge.mu.Unlock()
	if pendingCount != 0 {
		t.Fatalf("pending count = %d, want 0", pendingCount)
	}
}

func TestHTTPMCPRequestReturnsExtensionMissingWhenExtensionDisconnects(t *testing.T) {
	server := newTestServer(t)
	extension := dialWS(t, server, "/ws?type=extension")

	responseCh := make(chan httpMCPResult, 1)
	go func() {
		responseCh <- postMCP(t, server, `{"jsonrpc":"2.0","id":"disconnect","method":"tools/list"}`)
	}()

	_, forwarded, err := extension.ReadMessage()
	if err != nil {
		t.Fatalf("read forwarded request: %v", err)
	}
	requireForwardedMethod(t, forwarded, "tools/list")

	if err := extension.Close(); err != nil {
		t.Fatalf("close extension: %v", err)
	}

	result := receiveHTTPMCPResult(t, responseCh)
	if result.status != http.StatusServiceUnavailable {
		t.Fatalf("status = %d, want %d; body = %s", result.status, http.StatusServiceUnavailable, result.body)
	}

	var decoded struct {
		ID    json.RawMessage `json:"id"`
		Error struct {
			Code    int    `json:"code"`
			Message string `json:"message"`
		} `json:"error"`
	}
	if err := json.Unmarshal(result.body, &decoded); err != nil {
		t.Fatalf("decode response %q: %v", string(result.body), err)
	}
	if string(decoded.ID) != `"disconnect"` {
		t.Fatalf("id = %s, want %q", decoded.ID, `"disconnect"`)
	}
	if decoded.Error.Code != -32000 || decoded.Error.Message != "Extension not connected" {
		t.Fatalf("error = %+v, want extension not connected", decoded.Error)
	}
}

func TestHTTPMCPRejectsUnsupportedMethod(t *testing.T) {
	server := newTestServer(t)

	request, err := http.NewRequest(http.MethodGet, server.URL+"/mcp", nil)
	if err != nil {
		t.Fatalf("create request: %v", err)
	}
	response, err := httpTestClient.Do(request)
	if err != nil {
		t.Fatalf("get /mcp: %v", err)
	}
	defer response.Body.Close()
	if response.StatusCode != http.StatusMethodNotAllowed {
		t.Fatalf("status = %d, want %d", response.StatusCode, http.StatusMethodNotAllowed)
	}
}

func TestHTTPMCPRequestWithoutAcceptHeaderReturnsExtensionMissing(t *testing.T) {
	server := newTestServer(t)

	request, err := http.NewRequest(http.MethodPost, server.URL+"/mcp", strings.NewReader(`{"jsonrpc":"2.0","id":"no-accept","method":"tools/list"}`))
	if err != nil {
		t.Fatalf("create request: %v", err)
	}
	request.Header.Set("Content-Type", "application/json")

	response, err := httpTestClient.Do(request)
	if err != nil {
		t.Fatalf("post /mcp without accept header: %v", err)
	}
	defer response.Body.Close()

	body, err := io.ReadAll(response.Body)
	if err != nil {
		t.Fatalf("read response body: %v", err)
	}
	if response.StatusCode != http.StatusServiceUnavailable {
		t.Fatalf("status = %d, want %d; body = %s", response.StatusCode, http.StatusServiceUnavailable, body)
	}

	var decoded struct {
		ID    json.RawMessage `json:"id"`
		Error struct {
			Code    int    `json:"code"`
			Message string `json:"message"`
		} `json:"error"`
	}
	if err := json.Unmarshal(body, &decoded); err != nil {
		t.Fatalf("decode response %q: %v", string(body), err)
	}
	if string(decoded.ID) != `"no-accept"` {
		t.Fatalf("id = %s, want %q", decoded.ID, `"no-accept"`)
	}
	if decoded.Error.Code != -32000 || decoded.Error.Message != "Extension not connected" {
		t.Fatalf("error = %+v, want extension not connected", decoded.Error)
	}
}

func TestHTTPMCPRejectsNonObjectJSON(t *testing.T) {
	server := newTestServer(t)

	for _, body := range []string{"null", `[]`} {
		result := requireHTTPMCPResult(t, postMCP(t, server, body))
		if result.status != http.StatusBadRequest {
			t.Fatalf("body %s: status = %d, want %d; response = %s", body, result.status, http.StatusBadRequest, result.body)
		}

		var decoded struct {
			ID    json.RawMessage `json:"id"`
			Error struct {
				Code    int    `json:"code"`
				Message string `json:"message"`
			} `json:"error"`
		}
		if err := json.Unmarshal(result.body, &decoded); err != nil {
			t.Fatalf("body %s: decode response %q: %v", body, string(result.body), err)
		}
		if string(decoded.ID) != "null" {
			t.Fatalf("body %s: id = %s, want null", body, decoded.ID)
		}
		if decoded.Error.Code != -32700 || decoded.Error.Message != "Parse error" {
			t.Fatalf("body %s: error = %+v, want parse error", body, decoded.Error)
		}
	}
}

func TestHTTPMCPRejectsMalformedRequestObjects(t *testing.T) {
	server := newTestServer(t)
	extension := dialWS(t, server, "/ws?type=extension")
	defer extension.Close()

	for _, body := range []string{
		`{}`,
		`{"jsonrpc":"2.0"}`,
		`{"jsonrpc":"1.0","method":"tools/list"}`,
		`{"jsonrpc":"2.0","method":3}`,
	} {
		result := requireHTTPMCPResult(t, postMCP(t, server, body))
		if result.status != http.StatusBadRequest {
			t.Fatalf("body %s: status = %d, want %d; response = %s", body, result.status, http.StatusBadRequest, result.body)
		}

		var decoded struct {
			Error struct {
				Code int `json:"code"`
			} `json:"error"`
		}
		if err := json.Unmarshal(result.body, &decoded); err != nil {
			t.Fatalf("body %s: decode response %q: %v", body, string(result.body), err)
		}
		if decoded.Error.Code != -32600 {
			t.Fatalf("body %s: error code = %d, want -32600", body, decoded.Error.Code)
		}
	}
}

func TestRootServesIndexPage(t *testing.T) {
	server := newTestServer(t)

	response, err := http.Get(server.URL + "/")
	if err != nil {
		t.Fatalf("get index: %v", err)
	}
	defer response.Body.Close()

	if response.StatusCode != http.StatusOK {
		t.Fatalf("status = %d, want %d", response.StatusCode, http.StatusOK)
	}
}

func TestRootServesIndexPageOutsideBridgeWorkingDirectory(t *testing.T) {
	originalWD, err := os.Getwd()
	if err != nil {
		t.Fatalf("get working directory: %v", err)
	}
	t.Cleanup(func() {
		if err := os.Chdir(originalWD); err != nil {
			t.Fatalf("restore working directory: %v", err)
		}
	})
	if err := os.Chdir(t.TempDir()); err != nil {
		t.Fatalf("change working directory: %v", err)
	}

	server := newTestServer(t)
	response, err := http.Get(server.URL + "/")
	if err != nil {
		t.Fatalf("get index: %v", err)
	}
	defer response.Body.Close()

	if response.StatusCode != http.StatusOK {
		t.Fatalf("status = %d, want %d", response.StatusCode, http.StatusOK)
	}
}

func TestStaticFilesMatchDebugFrontendSources(t *testing.T) {
	for _, name := range []string{"index.html", "debug.js", "mcp-client.js", "bridge.js"} {
		debugFrontend, err := os.ReadFile(filepath.Join("..", "debug-frontend", name))
		if err != nil {
			t.Fatalf("read debug frontend %s: %v", name, err)
		}
		staticCopy, err := os.ReadFile(filepath.Join("static", name))
		if err != nil {
			t.Fatalf("read static copy %s: %v", name, err)
		}
		if !bytes.Equal(staticCopy, debugFrontend) {
			t.Fatalf("static/%s differs from ../debug-frontend/%s", name, name)
		}
	}
}

func requireJSONID(t *testing.T, data []byte) json.RawMessage {
	t.Helper()
	var message struct {
		ID json.RawMessage `json:"id"`
	}
	if err := json.Unmarshal(data, &message); err != nil {
		t.Fatalf("decode message %q: %v", string(data), err)
	}
	if len(message.ID) == 0 {
		t.Fatalf("message %q has no id", string(data))
	}
	return message.ID
}

func requireForwardedMethod(t *testing.T, data []byte, want string) {
	t.Helper()
	var message struct {
		Method string `json:"method"`
	}
	if err := json.Unmarshal(data, &message); err != nil {
		t.Fatalf("decode forwarded request %q: %v", string(data), err)
	}
	if message.Method != want {
		t.Fatalf("forwarded method = %q, want %q", message.Method, want)
	}
}

func requireRoutedResponseID(t *testing.T, data []byte, want string) {
	t.Helper()
	var response struct {
		ID json.RawMessage `json:"id"`
	}
	if err := json.Unmarshal(data, &response); err != nil {
		t.Fatalf("decode routed response %q: %v", string(data), err)
	}
	if string(response.ID) != want {
		t.Fatalf("routed response id = %s, want %s", response.ID, want)
	}
}

func requireRoutedResponse(t *testing.T, data []byte, wantID string, wantClient string) {
	t.Helper()
	var response struct {
		ID     json.RawMessage `json:"id"`
		Result struct {
			Client string `json:"client"`
		} `json:"result"`
	}
	if err := json.Unmarshal(data, &response); err != nil {
		t.Fatalf("decode routed response %q: %v", string(data), err)
	}
	if string(response.ID) != wantID {
		t.Fatalf("routed response id = %s, want %s", response.ID, wantID)
	}
	if response.Result.Client != wantClient {
		t.Fatalf("routed response client = %q, want %q", response.Result.Client, wantClient)
	}
}

func requireNoMessage(t *testing.T, conn *websocket.Conn, message string) {
	t.Helper()
	if err := conn.SetReadDeadline(time.Now().Add(100 * time.Millisecond)); err != nil {
		t.Fatalf("set short read deadline: %v", err)
	}
	_, _, err := conn.ReadMessage()
	if err == nil {
		t.Fatal(message)
	}
	if err := conn.SetReadDeadline(time.Now().Add(2 * time.Second)); err != nil {
		t.Fatalf("restore read deadline: %v", err)
	}
}

type httpMCPResult struct {
	status  int
	body    []byte
	err     error
	headers http.Header
}

var httpTestClient = &http.Client{Timeout: 2 * time.Second}

func postMCP(t *testing.T, server *httptest.Server, body string) httpMCPResult {
	return postMCPWithHeaders(t, server, body, nil)
}

func postMCPWithHeaders(t *testing.T, server *httptest.Server, body string, headers map[string]string) httpMCPResult {
	t.Helper()
	request, err := http.NewRequest(http.MethodPost, server.URL+"/mcp", strings.NewReader(body))
	if err != nil {
		return httpMCPResult{err: err}
	}
	request.Header.Set("Content-Type", "application/json")
	request.Header.Set("Accept", "application/json, text/event-stream")
	for name, value := range headers {
		request.Header.Set(name, value)
	}

	response, err := httpTestClient.Do(request)
	if err != nil {
		return httpMCPResult{err: err}
	}
	defer response.Body.Close()

	data, err := io.ReadAll(response.Body)
	if err != nil {
		return httpMCPResult{status: response.StatusCode, headers: response.Header, err: err}
	}
	return httpMCPResult{status: response.StatusCode, body: data, headers: response.Header}
}

func receiveHTTPMCPResult(t *testing.T, ch <-chan httpMCPResult) httpMCPResult {
	t.Helper()
	select {
	case result := <-ch:
		return requireHTTPMCPResult(t, result)
	case <-time.After(2 * time.Second):
		t.Fatal("timed out waiting for HTTP MCP result")
		return httpMCPResult{}
	}
}

func requireHTTPMCPResult(t *testing.T, result httpMCPResult) httpMCPResult {
	t.Helper()
	if result.err != nil {
		t.Fatalf("HTTP MCP request failed: %v", result.err)
	}
	return result
}

func newTestServer(t *testing.T) *httptest.Server {
	t.Helper()
	server := httptest.NewServer(NewBridge().Routes())
	t.Cleanup(server.Close)
	return server
}

func dialWS(t *testing.T, server *httptest.Server, path string) *websocket.Conn {
	t.Helper()
	url := "ws" + strings.TrimPrefix(server.URL, "http") + path
	conn, _, err := websocket.DefaultDialer.Dial(url, nil)
	if err != nil {
		t.Fatalf("dial %s: %v", url, err)
	}
	if err := conn.SetReadDeadline(time.Now().Add(2 * time.Second)); err != nil {
		t.Fatalf("set read deadline: %v", err)
	}
	return conn
}
