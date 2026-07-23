import { describe, it, expect, beforeEach } from "vitest";
import { chromeMock } from "./helpers/setup.mjs";

// Importing registers the delegated click listener on the test document
import "../src/content-script.js";

function addPrintButton({ id = "webPrint", className, printer, print, action } = {}) {
  const button = document.createElement("button");
  if (id) {
    button.id = id;
  }
  if (className) {
    button.className = className;
  }
  if (printer) {
    button.dataset.printer = printer;
  }
  if (print) {
    button.dataset.print = print;
  }
  if (action) {
    button.dataset.action = action;
  }
  document.body.append(button);
  return button;
}

function addDrawerButton({ printer } = {}) {
  return addPrintButton({ id: null, className: "olorinPlugin", printer, action: "cash-drawer" });
}

function addSlip(html = "<p>slip content</p>") {
  const slip = document.createElement("div");
  slip.id = "receipt";
  slip.innerHTML = html;
  document.body.append(slip);
  return slip;
}

function lastResultEvent(eventName = "olorin:print-result") {
  return new Promise((resolve) => {
    document.addEventListener(eventName, (event) => resolve(event.detail), {
      once: true,
    });
  });
}

describe("content script", () => {
  beforeEach(() => {
    chromeMock.runtime.sendMessage.mockImplementation((message, callback) =>
      callback({ success: true, data: { id: "print", success: true, printer: "P1" } }),
    );
  });

  it("sends the print payload when the Koha button is clicked", () => {
    addSlip("<p>Checked out: 3</p>");
    const button = addPrintButton({ printer: "receipt_printer", print: "#receipt" });

    button.click();

    expect(chromeMock.runtime.sendMessage).toHaveBeenCalledWith(
      {
        type: "websocket-send",
        payload: {
          id: "print",
          text: "printer-command",
          content: "<p>Checked out: 3</p>",
          printer: "receipt_printer",
        },
      },
      expect.any(Function),
    );
  });

  it("works for buttons added after the script loads (delegation)", () => {
    addSlip();
    // Koha injects slip buttons dynamically and IntranetSlipPrinterJS
    // triggers the click programmatically.
    const late = addPrintButton({
      id: null,
      className: "olorinPlugin",
      printer: "label_printer",
      print: "#receipt",
    });
    late.click();

    expect(chromeMock.runtime.sendMessage).toHaveBeenCalledOnce();
    expect(chromeMock.runtime.sendMessage.mock.calls[0][0].payload.printer).toBe("label_printer");
  });

  it("works when a child element inside the button is clicked", () => {
    addSlip();
    const button = addPrintButton({ printer: "receipt_printer", print: "#receipt" });
    const icon = document.createElement("span");
    button.append(icon);

    icon.click();

    expect(chromeMock.runtime.sendMessage).toHaveBeenCalledOnce();
  });

  it("does nothing when data attributes are missing", () => {
    addSlip();
    const button = addPrintButton({});
    button.click();
    expect(chromeMock.runtime.sendMessage).not.toHaveBeenCalled();
  });

  it("does nothing for unrelated clicks", () => {
    const plain = document.createElement("button");
    document.body.append(plain);
    plain.click();
    expect(chromeMock.runtime.sendMessage).not.toHaveBeenCalled();
  });

  it("dispatches a success result event", async () => {
    addSlip();
    const button = addPrintButton({ printer: "receipt_printer", print: "#receipt" });
    const result = lastResultEvent();

    button.click();

    await expect(result).resolves.toEqual({ success: true, error: undefined });
  });

  it("dispatches a failure result when the companion reports an error", async () => {
    chromeMock.runtime.sendMessage.mockImplementation((message, callback) =>
      callback({ success: true, data: { id: "print", success: false, error: "Unknown printer" } }),
    );
    addSlip();
    const button = addPrintButton({ printer: "receipt_printer", print: "#receipt" });
    const result = lastResultEvent();

    button.click();

    await expect(result).resolves.toEqual({ success: false, error: "Unknown printer" });
  });

  it("dispatches a failure result when the proxy cannot connect", async () => {
    chromeMock.runtime.sendMessage.mockImplementation((message, callback) =>
      callback({ success: false, error: "Could not connect to the Companion App" }),
    );
    addSlip();
    const button = addPrintButton({ printer: "receipt_printer", print: "#receipt" });
    const result = lastResultEvent();

    button.click();

    await expect(result).resolves.toEqual({
      success: false,
      error: "Could not connect to the Companion App",
    });
  });

  describe("cash drawer buttons", () => {
    beforeEach(() => {
      chromeMock.runtime.sendMessage.mockImplementation((message, callback) =>
        callback({ success: true, data: { id: "kick", success: true, printer: "P1" } }),
      );
    });

    it("sends the kick payload instead of a print message", () => {
      const button = addDrawerButton({ printer: "receipt_printer" });

      button.click();

      expect(chromeMock.runtime.sendMessage).toHaveBeenCalledWith(
        {
          type: "websocket-send",
          payload: {
            id: "kick",
            text: "kick-drawer",
            printer: "receipt_printer",
          },
        },
        expect.any(Function),
      );
    });

    it("dispatches a drawer success result event", async () => {
      const button = addDrawerButton({ printer: "receipt_printer" });
      const result = lastResultEvent("olorin:drawer-result");

      button.click();

      await expect(result).resolves.toEqual({ success: true, error: undefined });
    });

    it("dispatches a drawer failure result when the companion reports an error", async () => {
      chromeMock.runtime.sendMessage.mockImplementation((message, callback) =>
        callback({ success: true, data: { id: "kick", success: false, error: "No drawer" } }),
      );
      const button = addDrawerButton({ printer: "receipt_printer" });
      const result = lastResultEvent("olorin:drawer-result");

      button.click();

      await expect(result).resolves.toEqual({ success: false, error: "No drawer" });
    });

    it("dispatches a drawer failure result when the proxy cannot connect", async () => {
      chromeMock.runtime.sendMessage.mockImplementation((message, callback) =>
        callback({ success: false, error: "Could not connect to the Companion App" }),
      );
      const button = addDrawerButton({ printer: "receipt_printer" });
      const result = lastResultEvent("olorin:drawer-result");

      button.click();

      await expect(result).resolves.toEqual({
        success: false,
        error: "Could not connect to the Companion App",
      });
    });

    it("does nothing when data-printer is missing", () => {
      const button = addDrawerButton({});
      const seen = [];
      document.addEventListener("olorin:drawer-result", (event) => seen.push(event.detail));

      button.click();

      expect(chromeMock.runtime.sendMessage).not.toHaveBeenCalled();
      expect(seen).toEqual([]);
    });

    it("leaves ordinary print buttons unaffected", () => {
      addSlip("<p>Checked out: 3</p>");
      const button = addPrintButton({ printer: "receipt_printer", print: "#receipt" });

      button.click();

      expect(chromeMock.runtime.sendMessage).toHaveBeenCalledOnce();
      const payload = chromeMock.runtime.sendMessage.mock.calls[0][0].payload;
      expect(payload.text).toBe("printer-command");
      expect(payload.content).toBe("<p>Checked out: 3</p>");
    });
  });

  it("dispatches a failure result when the print target does not exist", async () => {
    const button = addPrintButton({ printer: "receipt_printer", print: "#missing" });
    const result = lastResultEvent();

    button.click();

    await expect(result).resolves.toEqual({
      success: false,
      error: "No element matches selector '#missing'",
    });
    expect(chromeMock.runtime.sendMessage).not.toHaveBeenCalled();
  });

  describe("inbound event API", () => {
    function dispatchApiEvent(eventName, detail) {
      document.dispatchEvent(new CustomEvent(eventName, { detail }));
    }

    it("answers olorin:ping with olorin:pong echoing the id and the extension version", async () => {
      const pong = lastResultEvent("olorin:pong");

      dispatchApiEvent("olorin:ping", { id: "ping-7" });

      await expect(pong).resolves.toEqual({ id: "ping-7", version: "1.2.3" });
    });

    it("answers an id-less olorin:ping without inventing an id", () => {
      const pongs = [];
      document.addEventListener("olorin:pong", (event) => pongs.push(event.detail));

      document.dispatchEvent(new CustomEvent("olorin:ping"));

      expect(pongs).toEqual([{ version: "1.2.3" }]);
      expect("id" in pongs[0]).toBe(false);
    });

    it("reports the companion's hello response for olorin:status", async () => {
      chromeMock.runtime.sendMessage.mockImplementation((message, callback) =>
        callback({ success: true, data: { id: "hello", version: "2.0.4", protocol: 1 } }),
      );
      const result = lastResultEvent("olorin:status-result");

      dispatchApiEvent("olorin:status", { id: "status-1" });

      expect(chromeMock.runtime.sendMessage).toHaveBeenCalledWith(
        { type: "websocket-send", payload: { id: "hello", text: "hello" } },
        expect.any(Function),
      );
      await expect(result).resolves.toEqual({
        id: "status-1",
        success: true,
        error: undefined,
        data: { id: "hello", version: "2.0.4", protocol: 1 },
      });
    });

    it("passes the proxy timeout through as a failed olorin:status-result", async () => {
      // Companion apps before 2.0 never answer hello — the proxy times out
      chromeMock.runtime.sendMessage.mockImplementation((message, callback) =>
        callback({ success: false, error: "Timed out waiting for the Companion App" }),
      );
      const results = [];
      document.addEventListener("olorin:status-result", (event) => results.push(event.detail));

      dispatchApiEvent("olorin:status", { id: "status-2" });

      expect(results).toEqual([
        { id: "status-2", success: false, error: "Timed out waiting for the Companion App" },
      ]);
      expect("data" in results[0]).toBe(false);
    });

    it("prints via a selector and passes inline overrides through verbatim", async () => {
      addSlip("<p>API slip</p>");
      const result = lastResultEvent();

      dispatchApiEvent("olorin:print", {
        id: "job-1",
        printer: "receipt_printer",
        selector: "#receipt",
        copies: 2,
        duplex: "long",
        pageWidth: 3.15,
        pageHeight: 8,
        marginTop: 0.1,
        marginRight: 0.2,
        marginBottom: 0.3,
        marginLeft: 0.4,
        orientation: "Portrait",
      });

      expect(chromeMock.runtime.sendMessage).toHaveBeenCalledWith(
        {
          type: "websocket-send",
          payload: {
            id: "print",
            text: "printer-command",
            content: "<p>API slip</p>",
            printer: "receipt_printer",
            copies: 2,
            duplex: "long",
            pageWidth: 3.15,
            pageHeight: 8,
            marginTop: 0.1,
            marginRight: 0.2,
            marginBottom: 0.3,
            marginLeft: 0.4,
            orientation: "Portrait",
          },
        },
        expect.any(Function),
      );
      await expect(result).resolves.toEqual({ id: "job-1", success: true, error: undefined });
    });

    it("prints raw content directly and omits the id when the request carried none", () => {
      const results = [];
      document.addEventListener("olorin:print-result", (event) => results.push(event.detail));

      dispatchApiEvent("olorin:print", { printer: "label_printer", content: "<p>direct</p>" });

      expect(chromeMock.runtime.sendMessage.mock.calls[0][0].payload).toEqual({
        id: "print",
        text: "printer-command",
        content: "<p>direct</p>",
        printer: "label_printer",
      });
      expect(results).toEqual([{ success: true, error: undefined }]);
      expect("id" in results[0]).toBe(false);
    });

    it("reports a missing selector target with the request id", async () => {
      const result = lastResultEvent();

      dispatchApiEvent("olorin:print", {
        id: "gone",
        printer: "receipt_printer",
        selector: "#missing",
      });

      await expect(result).resolves.toEqual({
        id: "gone",
        success: false,
        error: "No element matches selector '#missing'",
      });
      expect(chromeMock.runtime.sendMessage).not.toHaveBeenCalled();
    });

    it("kicks the drawer and echoes the id in the drawer result", async () => {
      chromeMock.runtime.sendMessage.mockImplementation((message, callback) =>
        callback({ success: true, data: { id: "kick", success: true, printer: "P1" } }),
      );
      const result = lastResultEvent("olorin:drawer-result");

      dispatchApiEvent("olorin:kick-drawer", { id: "till-1", printer: "receipt_printer" });

      expect(chromeMock.runtime.sendMessage).toHaveBeenCalledWith(
        {
          type: "websocket-send",
          payload: { id: "kick", text: "kick-drawer", printer: "receipt_printer" },
        },
        expect.any(Function),
      );
      await expect(result).resolves.toEqual({ id: "till-1", success: true, error: undefined });
    });

    it("reports an error instead of throwing when the printer is missing", async () => {
      const printResult = lastResultEvent();
      dispatchApiEvent("olorin:print", { id: "no-printer", selector: "#receipt" });
      await expect(printResult).resolves.toEqual({
        id: "no-printer",
        success: false,
        error: "The 'olorin:print' event detail is missing 'printer'",
      });

      const drawerResult = lastResultEvent("olorin:drawer-result");
      dispatchApiEvent("olorin:kick-drawer", {});
      await expect(drawerResult).resolves.toEqual({
        success: false,
        error: "The 'olorin:kick-drawer' event detail is missing 'printer'",
      });

      expect(chromeMock.runtime.sendMessage).not.toHaveBeenCalled();
    });

    it("reports an error for an olorin:print event with no detail at all", async () => {
      const result = lastResultEvent();

      document.dispatchEvent(new CustomEvent("olorin:print"));

      await expect(result).resolves.toEqual({
        success: false,
        error: "The 'olorin:print' event detail is missing 'printer'",
      });
    });

    it("reports an error when neither selector nor content is given", async () => {
      const result = lastResultEvent();

      dispatchApiEvent("olorin:print", { id: "empty", printer: "receipt_printer" });

      await expect(result).resolves.toEqual({
        id: "empty",
        success: false,
        error: "The 'olorin:print' event detail needs either 'selector' or 'content'",
      });
      expect(chromeMock.runtime.sendMessage).not.toHaveBeenCalled();
    });

    it("correlates concurrent requests by id even when responses arrive out of order", () => {
      const callbacks = [];
      chromeMock.runtime.sendMessage.mockImplementation((message, callback) =>
        callbacks.push(callback),
      );
      addSlip("<p>slip content</p>");
      const results = [];
      document.addEventListener("olorin:print-result", (event) => results.push(event.detail));

      dispatchApiEvent("olorin:print", {
        id: "first",
        printer: "receipt_printer",
        selector: "#receipt",
      });
      dispatchApiEvent("olorin:print", {
        id: "second",
        printer: "label_printer",
        selector: "#receipt",
      });

      // The companion answers the second request before the first
      callbacks[1]({ success: true, data: { id: "print", success: false, error: "Out of paper" } });
      callbacks[0]({ success: true, data: { id: "print", success: true } });

      expect(results).toEqual([
        { id: "second", success: false, error: "Out of paper" },
        { id: "first", success: true, error: undefined },
      ]);
    });

    it("click-path result events still carry no id", () => {
      addSlip();
      const button = addPrintButton({ printer: "receipt_printer", print: "#receipt" });
      const results = [];
      document.addEventListener("olorin:print-result", (event) => results.push(event.detail));

      button.click();

      expect(results).toEqual([{ success: true, error: undefined }]);
      expect("id" in results[0]).toBe(false);
    });
  });
});
