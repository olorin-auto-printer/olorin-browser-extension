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

describe("popup", () => {
  beforeEach(() => {
    chromeMock.runtime.sendMessage.mockImplementation((message, callback) =>
      callback({ connected: true }),
    );
  });

  it("shows the connected card when the companion app responds", async () => {
    await loadPopup();
    expect(visibleCards()).toEqual(["connected"]);
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
