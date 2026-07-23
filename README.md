# Olorin Browser Extension

Silent receipt and label printing for web applications, for both **Chrome**
and **Firefox**, built from a single shared source tree. Olorin was developed
for the [Koha ILS](https://koha-community.org/) and works with Koha out of
the box, but it is not tied to Koha — any web page that embeds its print
markup can use it.

The extension works together with the
[Olorin Companion App](https://github.com/olorin-auto-printer/olorin-companion-app),
a small desktop app that does the actual printing. The extension finds print
buttons embedded in the page, grabs the designated element's HTML, and
sends it to the companion app over a local WebSocket (`ws://localhost:9696`).
Nothing ever leaves the computer.

## How it works

1. The web application embeds a print button — in Koha, notice/slip
   templates carry it:

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

3. To print automatically when the page loads, trigger a click on the
   button from the page's own JavaScript. In Koha that means setting the
   `IntranetSlipPrinterJS` system preference to:

   ```javascript
   setTimeout(function () {
     $("#webPrint").trigger("click");
   }, 1000);
   ```

   (Any page script that dispatches a real click works — jQuery is not
   required.)

4. The extension's options page maps each logical printer to a real OS
   printer, with per-printer page size, margins, orientation, number of
   copies, and duplex (long edge / short edge) mode. Settings are stored by
   the companion app, so they are shared by every browser on the machine.

Pages can react to print outcomes by listening for a DOM event:

```javascript
document.addEventListener("olorin:print-result", (e) => console.log(e.detail));
// e.detail = { success: true } or { success: false, error: "..." }
```

### Opening a cash drawer

A button with `data-action="cash-drawer"` kicks open the till drawer
attached to the printer named by `data-printer` instead of printing (no
`data-print` is needed):

```html
<button class="olorinPlugin" data-action="cash-drawer" data-printer="receipt_printer">
  Open Drawer
</button>
```

The outcome is reported as an `olorin:drawer-result` DOM event with the
same `{ success, error }` detail shape as `olorin:print-result`.

## Use with other web applications

Nothing in Olorin depends on Koha. Two integration styles are available;
print buttons need zero JavaScript, while the event API is the recommended
path for applications that drive printing from their own code. Either way,
printer mappings, page sizes, margins, copies, and duplex are configured
once per workstation in the extension's Settings page or the companion
app's window — the page never needs to know about physical printers.

### Print buttons (zero JavaScript)

- Embed an element with id `webPrint` or class `olorinPlugin` carrying
  `data-printer` (one of the five logical printer keys) and `data-print`
  (a CSS selector for the element to print) — or
  `data-action="cash-drawer"` plus `data-printer` to open a till drawer.
- A user click (or a programmatic click dispatched by the page) triggers
  the action; the selected element's `innerHTML` is printed silently.
- Listen for the `olorin:print-result` / `olorin:drawer-result` DOM events
  to react to outcomes.

### The event API (extension 2.1 and later)

The recommended programmatic path — used by the Koha plugin's client
library, for example — is to dispatch CustomEvents on `document` instead
of synthesizing clicks on a hidden button. Available from extension 2.1:

| Request event        | Detail fields                                        | Result event           |
| -------------------- | ---------------------------------------------------- | ---------------------- |
| `olorin:ping`        | `id?`                                                | `olorin:pong`          |
| `olorin:status`      | `id?`                                                | `olorin:status-result` |
| `olorin:print`       | `id?`, `printer`, `selector` or `content`, overrides | `olorin:print-result`  |
| `olorin:kick-drawer` | `id?`, `printer`                                     | `olorin:drawer-result` |

```javascript
// Detect the extension: ping is answered immediately with the version
document.addEventListener("olorin:pong", (e) => console.log(e.detail));
// e.detail = { id: "hello", version: "2.1.0" }
document.dispatchEvent(new CustomEvent("olorin:ping", { detail: { id: "hello" } }));

// Ask the companion app for its version and protocol
document.addEventListener("olorin:status-result", (e) => console.log(e.detail));
// e.detail = { id: "st-1", success: true, data: { version: "...", protocol: ... } }
// (companion apps before 2.0 never answer — expect { success: false, error: "Timed out ..." })
document.dispatchEvent(new CustomEvent("olorin:status", { detail: { id: "st-1" } }));

// Print an element — or pass raw HTML via 'content' instead of 'selector'
document.dispatchEvent(
  new CustomEvent("olorin:print", {
    detail: {
      id: "job-1", // optional, echoed in the result event
      printer: "receipt_printer", // one of the five logical printer keys
      selector: "#receipt", // or: content: "<h1>Receipt</h1>..."
      copies: 2, // optional per-job overrides, passed through verbatim:
      duplex: "long", // copies, duplex, pageWidth, pageHeight, marginTop,
      orientation: "Portrait", // marginRight, marginBottom, marginLeft, orientation
    },
  }),
);

// Open a cash drawer
document.dispatchEvent(
  new CustomEvent("olorin:kick-drawer", {
    detail: { id: "till-1", printer: "receipt_printer" },
  }),
);
```

Outcomes arrive as the same `olorin:print-result` / `olorin:drawer-result`
events the button flow dispatches. When a request detail carries an `id`,
the result detail echoes it — dispatch concurrent requests with distinct
ids and match results by `detail.id`. Requests without an id produce
results without one, exactly like button clicks.

## Koha configuration

[docs/KOHA_COOKBOOK.md](docs/KOHA_COOKBOOK.md) has ready-to-paste notice
templates for a checkout quick slip and a hold slip, the
`IntranetSlipPrinterJS` auto-print snippet, a cash drawer button, and an
`IntranetUserJS` snippet that alerts staff when a print fails.

## Deploying to many machines

[docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) covers force-installing the
extension on managed workstations: Chrome's `ExtensionInstallForcelist`
policy and Firefox's `policies.json` `ExtensionSettings`.

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
