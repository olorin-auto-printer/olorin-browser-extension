// Generates Chrome Web Store screenshots (1280x800) of the real extension
// running against a stub companion app. Run from the extension repo root.
import { chromium } from "@playwright/test";
import { WebSocketServer } from "ws";
import http from "node:http";
import path from "node:path";
import fs from "node:fs";

const repoRoot = process.cwd();
const distChrome = path.join(repoRoot, "dist", "chrome");
const outDir = path.join(repoRoot, "docs", "store-assets");
fs.mkdirSync(outDir, { recursive: true });

const PRINTERS = [
  { name: "EPSON TM-T88V Receipt" },
  { name: "DYMO LabelWriter 450" },
  { name: "Zebra ZD410" },
  { name: "HP LaserJet Pro M404" },
];

const SAMPLE_OPTIONS = {
  receipt_printer: "EPSON TM-T88V Receipt",
  receipt_printer_width: "3.125",
  receipt_printer_height: "8",
  receipt_printer_orientation: "Portrait",
  receipt_printer_copies: "1",
  label_printer: "DYMO LabelWriter 450",
  label_printer_width: "2.25",
  label_printer_height: "1.25",
  label_printer_orientation: "Landscape",
  sticker_printer: "Zebra ZD410",
  full_sheet_printer: "HP LaserJet Pro M404",
  full_sheet_printer_width: "8.5",
  full_sheet_printer_height: "11",
  full_sheet_printer_duplex: "long",
  paper_printer: "HP LaserJet Pro M404",
};

// Stub companion
const wss = new WebSocketServer({ host: "127.0.0.1", port: 9696 });
wss.on("connection", (ws) => {
  ws.on("message", (raw) => {
    const message = JSON.parse(raw.toString());
    if (message.text === "list-printer") {
      ws.send(JSON.stringify({ id: "printerList", printer: PRINTERS }));
    } else if (message.text === "get-options") {
      ws.send(JSON.stringify(SAMPLE_OPTIONS));
    } else if (message.text === "hello") {
      ws.send(JSON.stringify({ id: "hello", version: "2.0.0", protocol: 2 }));
    } else if (message.text === "printer-command") {
      ws.send(JSON.stringify({ id: "print", success: true, printer: "EPSON TM-T88V Receipt" }));
    } else {
      ws.send(JSON.stringify({ success: true }));
    }
  });
});

// Demo slip page
const slipHtml = `<!doctype html><html><head><title>Koha › Circulation › Quick slip</title>
<style>body{font-family:Arial,sans-serif;background:#f3f4f4;margin:0}
.navbar{background:#408540;color:#fff;padding:10px 18px;font-size:15px;font-weight:bold}
.wrap{max-width:420px;margin:40px auto;background:#fff;border:1px solid #b9d8d9;padding:24px;border-radius:4px}
h1{font-size:16px;border-bottom:2px solid #b9d8d9;padding-bottom:8px;margin-top:0}
p{font-size:13px;margin:6px 0}.due{font-weight:bold}
#webPrint{background:#408540;border:none;color:#fff;padding:8px 22px;font-size:14px;border-radius:3px;margin-top:14px;cursor:pointer}
.hint{color:#666;font-size:11px;margin-top:12px}</style></head><body>
<div class="navbar">Koha staff interface — Circulation</div>
<div class="wrap">
<span id="receipt">
<h1>Springfield Public Library</h1>
<p>Checked out to: Marian Paroo (23529001234567)</p>
<p>2026-07-22 10:14</p>
<hr/>
<p>The Fellowship of the Ring<br/><span class="due">Due: 2026-08-12</span></p>
<p>A Wizard of Earthsea<br/><span class="due">Due: 2026-08-12</span></p>
<hr/>
<p>Thank you for visiting!</p>
</span>
<button id="webPrint" data-printer="receipt_printer" data-print="#receipt">Print Slip</button>
<p class="hint">This button is the only markup a page needs to print through Olorin.</p>
</div></body></html>`;

const httpServer = http.createServer((req, res) => {
  res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
  res.end(slipHtml);
});
await new Promise((resolve) => httpServer.listen(8123, "127.0.0.1", resolve));

const context = await chromium.launchPersistentContext("", {
  headless: false,
  viewport: { width: 1280, height: 800 },
  args: [`--disable-extensions-except=${distChrome}`, `--load-extension=${distChrome}`],
});

// Find the extension id via the service worker
let [worker] = context.serviceWorkers();
if (!worker) {
  worker = await context.waitForEvent("serviceworker");
}
const extensionId = new URL(worker.url()).host;
console.log("extension id:", extensionId);

const page = await context.newPage();

// 1. Options page, populated from the stub companion
await page.goto(`chrome-extension://${extensionId}/options.html`);
await page.waitForFunction(() => document.querySelectorAll("#receipt_printer option").length > 1);
await page.waitForTimeout(400);
await page.screenshot({ path: path.join(outDir, "screenshot-settings-1280x800.png") });
console.log("saved settings screenshot");

// 2. Popup (connected, with version)
await page.goto(`chrome-extension://${extensionId}/popup.html`);
await page.waitForFunction(() => {
  const card = document.getElementById("connected");
  return card && card.style.display !== "none" && card.style.display !== "";
});
await page.waitForFunction(() =>
  document.getElementById("companion_version").textContent.includes("2.0.0"),
);
await page.waitForTimeout(300);
await page.screenshot({ path: path.join(outDir, "screenshot-popup-1280x800.png") });
console.log("saved popup screenshot");

// 3. Demo slip page
await page.goto("http://127.0.0.1:8123/");
await page.waitForTimeout(300);
await page.screenshot({ path: path.join(outDir, "screenshot-slip-1280x800.png") });
console.log("saved slip screenshot");

await context.close();
wss.close();
httpServer.close();
console.log("done");
process.exit(0);
