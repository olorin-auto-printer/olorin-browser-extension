import { describe, it, expect, vi } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromeMock } from "./helpers/setup.mjs";

const srcDir = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "src");

function readLocale(locale) {
  return JSON.parse(
    fs.readFileSync(path.join(srcDir, "_locales", locale, "messages.json"), "utf8"),
  );
}

// Parse the whole file (head included, for the options <title>) rather than
// just the body, unlike the popup/options page tests.
function parseHtml(file) {
  const html = fs.readFileSync(path.join(srcDir, file), "utf8");
  return new DOMParser().parseFromString(html, "text/html");
}

describe("i18n annotations", () => {
  for (const file of ["popup.html", "options.html"]) {
    it(`every data-i18n key in ${file} resolves to a non-empty en message`, () => {
      const elements = [...parseHtml(file).querySelectorAll("[data-i18n]")];
      expect(elements.length).toBeGreaterThan(0);
      for (const element of elements) {
        const key = element.getAttribute("data-i18n");
        expect(chromeMock.i18n.getMessage(key), `key '${key}'`).not.toBe("");
      }
    });

    it(`every data-i18n-placeholder key in ${file} resolves to a non-empty en message`, () => {
      for (const element of parseHtml(file).querySelectorAll("[data-i18n-placeholder]")) {
        const key = element.getAttribute("data-i18n-placeholder");
        expect(chromeMock.i18n.getMessage(key), `key '${key}'`).not.toBe("");
      }
    });
  }

  it("fr and es translate exactly the keys en defines", () => {
    const enKeys = Object.keys(readLocale("en")).sort();
    expect(Object.keys(readLocale("fr")).sort()).toEqual(enKeys);
    expect(Object.keys(readLocale("es")).sort()).toEqual(enKeys);
  });
});

describe("i18n.js", () => {
  it("applies messages to text, input values, and placeholders", async () => {
    document.body.innerHTML = `
      <h1 data-i18n="popupConnectedTitle">stale</h1>
      <input type="text" data-i18n="optionsPrinterReceipt" value="stale" />
      <input type="number" data-i18n-placeholder="optionsWidthPlaceholder" placeholder="stale" />
      <p data-i18n="noSuchKey">English fallback</p>
    `;
    vi.resetModules();
    await import("../src/i18n.js");

    expect(document.querySelector("h1").textContent).toBe("Companion App Connected");
    expect(document.querySelector("input[data-i18n]").value).toBe("Receipt Printer");
    expect(document.querySelector("input[data-i18n-placeholder]").placeholder).toBe("Width (In)");
    // A missing key leaves the English text from the HTML in place
    expect(document.querySelector("p").textContent).toBe("English fallback");
  });
});
