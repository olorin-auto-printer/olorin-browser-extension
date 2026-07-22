// Global test setup: a persistent chrome.* mock and a controllable WebSocket
// mock. The mock objects keep their identity across tests (background.js
// registers its message listener once at import time), but call history and
// socket instances are reset before every test.
import { beforeEach, vi } from "vitest";

export class MockWebSocket {
  static instances = [];

  constructor(url) {
    this.url = url;
    this.sent = [];
    this.closed = false;
    this.onopen = null;
    this.onmessage = null;
    this.onerror = null;
    this.onclose = null;
    MockWebSocket.instances.push(this);
  }

  send(data) {
    this.sent.push(data);
  }

  close() {
    this.closed = true;
    if (this.onclose) {
      this.onclose({ type: "close" });
    }
  }

  // Test drivers
  serverOpen() {
    if (this.onopen) {
      this.onopen({ type: "open" });
    }
  }

  serverReply(data) {
    if (this.onmessage) {
      this.onmessage({
        type: "message",
        data: typeof data === "string" ? data : JSON.stringify(data),
      });
    }
  }

  serverError() {
    if (this.onerror) {
      this.onerror({ type: "error" });
    }
  }

  static get last() {
    return MockWebSocket.instances[MockWebSocket.instances.length - 1];
  }
}

const messageListeners = [];

export const chromeMock = {
  runtime: {
    onMessage: {
      addListener: (listener) => messageListeners.push(listener),
    },
    sendMessage: vi.fn(),
    openOptionsPage: vi.fn(),
    lastError: undefined,
    getURL: (p) => `chrome-extension://test-id/${p}`,
  },
  permissions: {
    contains: vi.fn((query, callback) => callback(true)),
    request: vi.fn((query, callback) => callback && callback(true)),
  },
  tabs: {
    create: vi.fn(),
  },
};

// Deliver a runtime message to every registered background listener, the way
// the browser would.
export function deliverMessage(message, sender = {}) {
  const responses = [];
  for (const listener of messageListeners) {
    const sendResponse = (response) => responses.push(response);
    listener(message, sender, sendResponse);
  }
  return responses;
}

globalThis.chrome = chromeMock;
globalThis.WebSocket = MockWebSocket;

beforeEach(() => {
  MockWebSocket.instances = [];
  chromeMock.runtime.sendMessage.mockReset();
  chromeMock.runtime.openOptionsPage.mockClear();
  chromeMock.runtime.lastError = undefined;
  chromeMock.permissions.contains.mockReset();
  chromeMock.permissions.contains.mockImplementation((query, callback) => callback(true));
  chromeMock.permissions.request.mockReset();
  chromeMock.permissions.request.mockImplementation(
    (query, callback) => callback && callback(true),
  );
  chromeMock.tabs.create.mockClear();
  document.body.innerHTML = "";
});
