// End-to-end: load the built Chrome extension into a real Chromium, click a
// Koha-style print button on a fake slip page, and verify the printer-command
// arrives at a stub companion app over the real WebSocket protocol.
//
// Requires dist/chrome to exist — the test:e2e npm script runs the build
// first. Runs headed (headless: false) because Chromium only loads unpacked
// extensions in headed mode; CI wraps the run in xvfb.
import { test, expect, chromium } from "@playwright/test";
import { WebSocketServer } from "ws";
import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const extensionPath = path.join(root, "dist", "chrome");

const SLIP_PAGE = `<!doctype html>
<html>
  <body>
    <span id="receipt"><p>E2E receipt</p></span>
    <button id="webPrint" data-printer="receipt_printer" data-print="#receipt">Print</button>
  </body>
</html>
`;

// Stub companion app implementing the WebSocket protocol and recording
// every message it receives.
function startCompanionStub() {
  const received = [];
  let resolvePrinterCommand;
  const printerCommand = new Promise((resolve) => {
    resolvePrinterCommand = resolve;
  });

  const server = new WebSocketServer({ host: "127.0.0.1", port: 9696 });
  server.on("connection", (socket) => {
    socket.on("message", (raw) => {
      const message = JSON.parse(raw.toString());
      received.push(message);
      if (message.text === "list-printer") {
        socket.send(JSON.stringify({ id: message.id, printer: [{ name: "Stub_Printer" }] }));
      } else if (message.text === "get-options") {
        socket.send(JSON.stringify({ receipt_printer: "Stub_Printer" }));
      } else if (message.text === "printer-command") {
        socket.send(JSON.stringify({ id: message.id, success: true, printer: "Stub_Printer" }));
        resolvePrinterCommand(message);
      }
    });
  });

  return { server, received, printerCommand };
}

test("clicking a Koha print button prints through the companion app", async () => {
  const stub = startCompanionStub();

  const pageServer = http.createServer((request, response) => {
    response.writeHead(200, { "Content-Type": "text/html" });
    response.end(SLIP_PAGE);
  });
  await new Promise((resolve) => pageServer.listen(0, "127.0.0.1", resolve));
  const pageUrl = `http://127.0.0.1:${pageServer.address().port}/`;

  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), "olorin-e2e-"));
  const context = await chromium.launchPersistentContext(userDataDir, {
    headless: false,
    args: [`--disable-extensions-except=${extensionPath}`, `--load-extension=${extensionPath}`],
  });

  try {
    const page = await context.newPage();
    await page.goto(pageUrl);

    // Register the result listener before clicking so the event can't race
    await page.evaluate(() => {
      window.__olorinPrintResult = new Promise((resolve) => {
        document.addEventListener("olorin:print-result", (event) => resolve(event.detail), {
          once: true,
        });
      });
    });

    await page.click("#webPrint");

    const command = await stub.printerCommand;
    expect(command.id).toBe("print");
    expect(command.text).toBe("printer-command");
    expect(command.printer).toBe("receipt_printer");
    expect(command.content).toContain("E2E receipt");

    const result = await page.evaluate(() => window.__olorinPrintResult);
    expect(result.success).toBe(true);
  } finally {
    await context.close();
    pageServer.close();
    stub.server.close();
    fs.rmSync(userDataDir, { recursive: true, force: true });
  }
});
