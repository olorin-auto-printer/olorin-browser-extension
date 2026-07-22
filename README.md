# Olorin Browser Extension

Silent receipt and label printing for the [Koha ILS](https://koha-community.org/),
for both **Chrome** and **Firefox**, built from a single shared source tree.

The extension works together with the
[Olorin Companion App](https://github.com/olorin-auto-printer/olorin-companion-app),
a small desktop app that does the actual printing. The extension finds print
buttons that Koha embeds in slips and notices, grabs the slip's HTML, and
sends it to the companion app over a local WebSocket (`ws://localhost:9696`).
Nothing ever leaves the computer.

## How it works

1. Koha notice/slip templates embed a print button:

   ```html
   <button id="webPrint" data-printer="receipt_printer" data-print="#receipt">Print</button>
   ```

   `data-printer` names one of five logical printers — `receipt_printer`,
   `sticker_printer`, `paper_printer`, `full_sheet_printer`,
   `label_printer` — and `data-print` is a CSS selector for the element whose
   contents should print. Any element with the `olorinPlugin` class works the
   same way.

2. Wrap the printable part of the slip:

   ```html
   <span id="receipt"> ... slip content ... </span>
   ```

3. To print automatically when the slip page loads, set the Koha system
   preference `IntranetSlipPrinterJS` to:

   ```javascript
   setTimeout(function () {
     $("#webPrint").trigger("click");
   }, 1000);
   ```

4. The extension's options page maps each logical printer to a real OS
   printer, with per-printer page size, margins, and orientation. Settings
   are stored by the companion app, so they are shared by every browser on
   the machine.

Pages can react to print outcomes by listening for a DOM event:

```javascript
document.addEventListener("olorin:print-result", (e) => console.log(e.detail));
// e.detail = { success: true } or { success: false, error: "..." }
```

## Installation

1. Install and run the
   [Olorin Companion App](https://github.com/olorin-auto-printer/olorin-companion-app/releases)
   and set it to run at login.
2. Install the extension for your browser (Chrome Web Store / Firefox
   Add-ons listing, or the packages from the release page).
3. Click the Olorin toolbar icon — it should report "Companion App
   Connected". On Firefox, if the popup asks for page access, click "Grant
   Access".
4. Open Settings from the popup and map each printer type you use to a real
   printer. Save.

## Development

```sh
npm install
npm test            # vitest unit tests
npm run lint        # eslint + prettier
npm run build       # builds dist/chrome and dist/firefox + zips in web-ext-artifacts/
npm run lint:firefox  # addons-linter on the built Firefox package
npm run start:firefox # run the built extension in a temporary Firefox profile
npm run check       # lint + test + lint:firefox
```

The source lives in `src/`. `manifest.base.json` holds everything the two
browsers share; `manifest.chrome.json` and `manifest.firefox.json` are
per-browser overlays merged at build time by `scripts/build.mjs`, which also
injects the version from `package.json` (the single source of truth for the
version number).

To load a development build: `chrome://extensions` → Developer mode → "Load
unpacked" → `dist/chrome`, or use `npm run start:firefox`.

## License

GPL-3.0 — see [LICENSE](LICENSE).
