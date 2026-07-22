// WebSocket proxy for the Olorin Companion App.
//
// Content scripts and extension pages send runtime messages here instead of
// opening sockets themselves. The background context owns the socket so the
// extension's localhost host permissions apply (Chrome 142+ gates local
// network access, and Chrome 147 extended that to WebSockets — extensions
// with matching host permissions are exempt from the permission prompt).

const COMPANION_URL = "ws://localhost:9696";
const RESPONSE_TIMEOUT_MS = 10000;
const DEBUG = false;

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message && message.type === "websocket-send") {
    proxySend(message.payload, sendResponse);
    return true;
  }

  if (message && message.type === "websocket-check") {
    checkConnection(sendResponse);
    return true;
  }
});

// Open a socket, send one payload, respond with the first reply, then close.
// Exactly one response is sent no matter which event fires first.
function proxySend(payload, sendResponse) {
  let settled = false;
  const ws = new WebSocket(COMPANION_URL);

  const finish = (response) => {
    if (settled) {
      return;
    }
    settled = true;
    clearTimeout(timer);
    try {
      ws.close();
    } catch {
      // Already closed
    }
    if (DEBUG) {
      console.log("[olorin] proxy response", response);
    }
    sendResponse(response);
  };

  const timer = setTimeout(
    () => finish({ success: false, error: "Timed out waiting for the Companion App" }),
    RESPONSE_TIMEOUT_MS,
  );

  ws.onopen = () => ws.send(JSON.stringify(payload));

  ws.onmessage = (event) => {
    let data;
    try {
      data = JSON.parse(event.data);
    } catch {
      finish({ success: false, error: "Invalid response from the Companion App" });
      return;
    }
    finish({ success: true, data });
  };

  ws.onerror = () => finish({ success: false, error: "Could not connect to the Companion App" });

  ws.onclose = () =>
    finish({ success: false, error: "Connection to the Companion App closed unexpectedly" });
}

function checkConnection(sendResponse) {
  let settled = false;
  const ws = new WebSocket(COMPANION_URL);

  const finish = (connected) => {
    if (settled) {
      return;
    }
    settled = true;
    clearTimeout(timer);
    try {
      ws.close();
    } catch {
      // Already closed
    }
    sendResponse({ connected });
  };

  const timer = setTimeout(() => finish(false), RESPONSE_TIMEOUT_MS);

  ws.onopen = () => finish(true);
  ws.onerror = () => finish(false);
}
