import { describe, it, expect, vi, beforeEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromeMock } from "./helpers/setup.mjs";

const popupHtml = fs.readFileSync(
  path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "src", "popup.html"),
  "utf8",
);

function visibleCards() {
  return [...document.querySelectorAll(".card")]
    .filter((card) => card.style.display !== "none")
    .map((card) => card.id);
}

async function loadPopup() {
  document.body.innerHTML = popupHtml.match(/<body>([\s\S]*)<\/body>/)[1];
  vi.resetModules();
  await import("../src/popup.js");
  await new Promise((resolve) => setTimeout(resolve, 0));
}

// Routes websocket-check to connected and hello to a version response (or a
// timeout failure, the way an old companion app behaves).
function mockCompanion({ connected = true, helloResponse } = {}) {
  chromeMock.runtime.sendMessage.mockImplementation((message, callback) => {
    if (message.type === "websocket-check") {
      callback({ connected });
      return;
    }
    if (message.type === "websocket-send" && message.payload.text === "hello") {
      callback(
        helloResponse || { success: false, error: "Timed out waiting for the Companion App" },
      );
    }
  });
}

describe("popup", () => {
  beforeEach(() => {
    mockCompanion();
  });

  it("shows the connected card when the companion app responds", async () => {
    await loadPopup();
    expect(visibleCards()).toEqual(["connected"]);
  });

  it("shows the companion version when hello answers", async () => {
    mockCompanion({
      helloResponse: { success: true, data: { id: "hello", version: "3.2.1", protocol: 2 } },
    });
    await loadPopup();

    expect(chromeMock.runtime.sendMessage).toHaveBeenCalledWith(
      { type: "websocket-send", payload: { id: "hello", text: "hello" } },
      expect.any(Function),
    );
    expect(visibleCards()).toEqual(["connected"]);
    expect(document.getElementById("companion_version").textContent).toBe("v3.2.1");
  });

  it("still shows the plain connected card when hello fails (old companion app)", async () => {
    await loadPopup();
    expect(visibleCards()).toEqual(["connected"]);
    expect(document.getElementById("companion_version").textContent).toBe("");
  });

  it("shows the not-connected card when the check fails", async () => {
    chromeMock.runtime.sendMessage.mockImplementation((message, callback) =>
      callback({ connected: false }),
    );
    await loadPopup();
    expect(visibleCards()).toEqual(["not_connected"]);
  });

  it("shows the not-connected card when messaging errors out", async () => {
    chromeMock.runtime.sendMessage.mockImplementation((message, callback) => {
      chromeMock.runtime.lastError = { message: "boom" };
      callback(undefined);
      chromeMock.runtime.lastError = undefined;
    });
    await loadPopup();
    expect(visibleCards()).toEqual(["not_connected"]);
  });

  it("opens the options page from the settings buttons", async () => {
    await loadPopup();

    document.querySelector("#connected .option-btn").click();

    expect(chromeMock.runtime.openOptionsPage).toHaveBeenCalledOnce();
    expect(chromeMock.tabs.create).not.toHaveBeenCalled();
  });

  it("shows the permission card when host access is missing (Firefox)", async () => {
    chromeMock.permissions.contains.mockImplementation((query, callback) => callback(false));
    await loadPopup();

    expect(visibleCards()).toEqual(["needs_permission"]);
    expect(chromeMock.runtime.sendMessage).not.toHaveBeenCalled();
  });

  it("requests host access from the grant button and re-checks the connection", async () => {
    chromeMock.permissions.contains.mockImplementation((query, callback) => callback(false));
    await loadPopup();

    document.getElementById("grant_permission").click();
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(chromeMock.permissions.request).toHaveBeenCalledWith(
      { origins: ["<all_urls>"] },
      expect.any(Function),
    );
    expect(visibleCards()).toEqual(["connected"]);
  });
});
