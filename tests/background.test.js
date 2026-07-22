import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { MockWebSocket, deliverMessage } from "./helpers/setup.mjs";

// Importing registers the listener on the persistent chrome mock
import "../src/background.js";

describe("background WebSocket proxy", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("websocket-send", () => {
    it("sends the payload and responds with the first reply", () => {
      const responses = deliverMessage({
        type: "websocket-send",
        payload: { id: "printerList", text: "list-printer" },
      });

      const ws = MockWebSocket.last;
      expect(ws.url).toBe("ws://localhost:9696");

      ws.serverOpen();
      expect(JSON.parse(ws.sent[0])).toEqual({ id: "printerList", text: "list-printer" });

      ws.serverReply({ id: "printerList", printer: [{ name: "P1" }] });
      expect(responses).toEqual([
        { success: true, data: { id: "printerList", printer: [{ name: "P1" }] } },
      ]);
      expect(ws.closed).toBe(true);
    });

    it("responds only once even if more events fire", () => {
      const responses = deliverMessage({ type: "websocket-send", payload: { id: "x" } });
      const ws = MockWebSocket.last;

      ws.serverOpen();
      ws.serverReply({ first: true });
      ws.serverReply({ second: true });
      ws.serverError();

      expect(responses).toHaveLength(1);
      expect(responses[0].data).toEqual({ first: true });
    });

    it("responds with an error when the connection fails", () => {
      const responses = deliverMessage({ type: "websocket-send", payload: { id: "x" } });
      MockWebSocket.last.serverError();

      expect(responses).toEqual([
        { success: false, error: "Could not connect to the Companion App" },
      ]);
      expect(MockWebSocket.last.closed).toBe(true);
    });

    it("responds with an error when the server closes without replying", () => {
      const responses = deliverMessage({ type: "websocket-send", payload: { id: "x" } });
      const ws = MockWebSocket.last;
      ws.serverOpen();
      ws.close();

      expect(responses).toEqual([
        { success: false, error: "Connection to the Companion App closed unexpectedly" },
      ]);
    });

    it("times out when the server accepts but never replies", () => {
      const responses = deliverMessage({ type: "websocket-send", payload: { id: "x" } });
      const ws = MockWebSocket.last;
      ws.serverOpen();

      vi.advanceTimersByTime(10001);

      expect(responses).toEqual([
        { success: false, error: "Timed out waiting for the Companion App" },
      ]);
      expect(ws.closed).toBe(true);
    });

    it("responds with an error on an unparseable reply", () => {
      const responses = deliverMessage({ type: "websocket-send", payload: { id: "x" } });
      const ws = MockWebSocket.last;
      ws.serverOpen();
      ws.serverReply("{not json");

      expect(responses).toEqual([
        { success: false, error: "Invalid response from the Companion App" },
      ]);
    });
  });

  describe("websocket-check", () => {
    it("reports connected when the socket opens", () => {
      const responses = deliverMessage({ type: "websocket-check" });
      MockWebSocket.last.serverOpen();
      expect(responses).toEqual([{ connected: true }]);
      expect(MockWebSocket.last.closed).toBe(true);
    });

    it("reports not connected on error", () => {
      const responses = deliverMessage({ type: "websocket-check" });
      MockWebSocket.last.serverError();
      expect(responses).toEqual([{ connected: false }]);
    });

    it("reports not connected after a timeout", () => {
      const responses = deliverMessage({ type: "websocket-check" });
      vi.advanceTimersByTime(10001);
      expect(responses).toEqual([{ connected: false }]);
    });
  });

  it("ignores unrelated message types", () => {
    const responses = deliverMessage({ type: "something-else" });
    expect(responses).toEqual([]);
    expect(MockWebSocket.instances).toHaveLength(0);
  });
});
