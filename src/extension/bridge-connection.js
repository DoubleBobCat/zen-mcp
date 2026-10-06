(function () {
  function createBridgeConnectionManager({ WebSocketCtor, setStatus, handleMessage, log, logError }) {
    let ws = null;
    let reconnectInterval = null;

    function clearReconnect() {
      if (reconnectInterval) {
        clearInterval(reconnectInterval);
        reconnectInterval = null;
      }
    }

    function scheduleReconnect(settings) {
      if (!reconnectInterval) {
        reconnectInterval = setInterval(() => {
          log("Trying to reconnect...");
          connect(settings);
        }, settings.reconnectInterval);
      }
    }

    function sendSocketResponse(socket, response) {
      if (response && socket.readyState === WebSocketCtor.OPEN) {
        socket.send(JSON.stringify(response));
      }
    }

    function connect(settings) {
      if (ws && (ws.readyState === WebSocketCtor.CONNECTING || ws.readyState === WebSocketCtor.OPEN)) {
        return;
      }

      let socket;
      try {
        socket = new WebSocketCtor(settings.url);
        ws = socket;
      } catch (err) {
        logError("Failed to connect:", err);
        setStatus("error");
        scheduleReconnect(settings);
        return;
      }

      socket.onopen = () => {
        if (ws !== socket) {
          return;
        }
        log("Connected to bridge server");
        setStatus("connected");
        clearReconnect();
      };

      socket.onmessage = (event) => {
        if (ws !== socket) {
          return;
        }
        try {
          const message = JSON.parse(event.data);
          log("Received from server:", message);
          const response = handleMessage(message);
          if (response instanceof Promise) {
            response.then((resolved) => sendSocketResponse(socket, resolved)).catch((err) => {
              logError("Failed to handle message:", err);
            });
            return;
          }
          sendSocketResponse(socket, response);
        } catch (err) {
          logError("Failed to parse message:", err);
        }
      };

      socket.onclose = () => {
        if (ws !== socket) {
          return;
        }
        log("Disconnected from bridge server");
        setStatus("disconnected");
        ws = null;
        scheduleReconnect(settings);
      };

      socket.onerror = (err) => {
        if (ws !== socket) {
          return;
        }
        logError("WebSocket error:", err);
        setStatus("error");
      };
    }

    function stop() {
      clearReconnect();
      if (ws) {
        const socket = ws;
        ws = null;
        socket.onclose = null;
        socket.onerror = null;
        socket.onmessage = null;
        socket.onopen = null;
        socket.close();
      }
    }

    function currentSocket() {
      return ws;
    }

    return { connect, stop, currentSocket };
  }

  globalThis.createBridgeConnectionManager = createBridgeConnectionManager;
})();
