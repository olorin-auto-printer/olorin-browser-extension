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
});
