import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromeMock } from "./helpers/setup.mjs";

const optionsHtml = fs.readFileSync(
  path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "src", "options.html"),
  "utf8",
);

const PRINTERS = [{ name: "EPSON_TM_T88V" }, { name: "Brother_QL_820" }];

let savedOptions;

function mockCompanion({ printers = PRINTERS, options = {}, unreachable = false } = {}) {
  chromeMock.runtime.sendMessage.mockImplementation((message, callback) => {
    if (unreachable) {
      callback({ success: false, error: "Could not connect to the Companion App" });
      return;
    }
    const payload = message.payload;
    if (payload.text === "list-printer") {
      callback({ success: true, data: { id: "printerList", printer: printers } });
    } else if (payload.text === "get-options") {
      callback({ success: true, data: options });
    } else if (payload.text === "set-options") {
      savedOptions = payload.options;
      callback({ success: true, data: { id: "set-options", success: true } });
    }
  });
}

async function loadOptionsPage() {
  document.body.innerHTML = optionsHtml.match(/<body>([\s\S]*)<\/body>/)[1];
  vi.resetModules();
  await import("../src/options.js");
  await vi.advanceTimersByTimeAsync(0);
}

describe("options page", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    savedOptions = undefined;
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("has 50 unique field names (10 settings for each of the 5 printers)", async () => {
    mockCompanion();
    await loadOptionsPage();

    // Regression-lock for the duplicated full_sheet_printer_margin_right of
    // the original: every named form field must be collected exactly once.
    const fieldNames = new Set();
    for (const field of document.querySelectorAll("[name]")) {
      if (!field.name.endsWith("_label")) {
        fieldNames.add(field.name);
      }
    }
    expect(fieldNames.size).toBe(50);
  });

  it("populates the five printer selects from list-printer", async () => {
    mockCompanion();
    await loadOptionsPage();

    for (const selectId of [
      "receipt_printer",
      "sticker_printer",
      "paper_printer",
      "full_sheet_printer",
      "label_printer",
    ]) {
      const values = [...document.getElementById(selectId).options].map((o) => o.value);
      expect(values).toEqual(["", "EPSON_TM_T88V", "Brother_QL_820"]);
    }
  });

  it("fills the form from saved options and skips missing values", async () => {
    mockCompanion({
      options: {
        receipt_printer: "EPSON_TM_T88V",
        receipt_printer_width: "3.125",
        receipt_printer_copies: "2",
        receipt_printer_duplex: "long",
      },
    });
    await loadOptionsPage();

    expect(document.getElementById("receipt_printer").value).toBe("EPSON_TM_T88V");
    expect(document.getElementById("receipt_printer_width").value).toBe("3.125");
    expect(document.getElementById("receipt_printer_copies").value).toBe("2");
    expect(document.getElementById("receipt_printer_duplex").value).toBe("long");
    // Unsaved fields stay empty rather than becoming the string "undefined"
    expect(document.getElementById("sticker_printer_width").value).toBe("");
  });

  it("saves all 50 fields on submit and shows a toast for 3 seconds", async () => {
    mockCompanion();
    await loadOptionsPage();

    document.getElementById("receipt_printer").value = "EPSON_TM_T88V";
    document.getElementById("receipt_printer_width").value = "3.125";
    document.getElementById("receipt_printer_copies").value = "2";
    document.getElementById("receipt_printer_duplex").value = "short";

    document.getElementById("printer").dispatchEvent(new Event("submit", { cancelable: true }));
    await vi.advanceTimersByTimeAsync(0);

    expect(Object.keys(savedOptions)).toHaveLength(50);
    expect(savedOptions.receipt_printer).toBe("EPSON_TM_T88V");
    expect(savedOptions.receipt_printer_width).toBe("3.125");
    expect(savedOptions.receipt_printer_copies).toBe("2");
    expect(savedOptions.receipt_printer_duplex).toBe("short");

    const toast = document.getElementById("save-msg");
    expect(toast.classList.contains("hide")).toBe(false);

    await vi.advanceTimersByTimeAsync(3001);
    expect(toast.classList.contains("hide")).toBe(true);
  });

  it("preserves selections when refreshing the printer list", async () => {
    mockCompanion();
    await loadOptionsPage();

    document.getElementById("receipt_printer").value = "Brother_QL_820";
    document.getElementById("refresh").click();
    await vi.advanceTimersByTimeAsync(0);

    expect(document.getElementById("receipt_printer").value).toBe("Brother_QL_820");
  });

  it("shows the error banner when the companion app is unreachable", async () => {
    mockCompanion({ unreachable: true });
    await loadOptionsPage();

    expect(document.getElementById("error-banner").classList.contains("hide")).toBe(false);
  });

  it("clears the error banner once the companion app responds again", async () => {
    mockCompanion({ unreachable: true });
    await loadOptionsPage();
    expect(document.getElementById("error-banner").classList.contains("hide")).toBe(false);

    mockCompanion();
    document.getElementById("refresh").click();
    await vi.advanceTimersByTimeAsync(0);

    expect(document.getElementById("error-banner").classList.contains("hide")).toBe(true);
  });
});
