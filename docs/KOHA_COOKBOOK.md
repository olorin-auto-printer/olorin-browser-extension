# Koha cookbook

Ready-to-paste snippets for wiring Koha up to the Olorin extension. The
pattern is always the same: a print button carrying the data attributes the
extension looks for, and a wrapper element around the part of the slip that
should print.

- `data-printer` — one of the five logical printers: `receipt_printer`,
  `sticker_printer`, `paper_printer`, `full_sheet_printer`, `label_printer`
- `data-print` — a CSS selector for the element whose contents print
- The button must have `id="webPrint"` or the `olorinPlugin` class

Notice templates are edited under **Tools → Notices & slips**.

## The Koha plugin (zero-edit deployment)

The `koha-plugin-olorin` Koha plugin wires all of this up automatically —
no notice templates or system preferences to edit — using the extension's
event API (extension 2.1 and later). Once released, installing the plugin
is the recommended deployment; the recipes below remain for manual setups
and as a reference for what the plugin does.

## Checkout quick slip (ISSUEQSLIP)

Replace the body of the `ISSUEQSLIP` notice (Print transport) with:

```html
<button id="webPrint" data-printer="receipt_printer" data-print="#receipt">Print</button>
<span id="receipt">
  <h3><<branches.branchname>></h3>
  <p>
    Checked out to <<borrowers.firstname>> <<borrowers.surname>> (<<borrowers.cardnumber>>)<br />
    <<today>>
  </p>
  <checkedout>
  <p>
    <<biblio.title>><br />
    Barcode: <<items.barcode>><br />
    Date due: <<issues.date_due>>
  </p>
  </checkedout>
  <p>Thank you for visiting!</p>
</span>
```

## Hold slip (HOLD_SLIP)

Replace the body of the `HOLD_SLIP` notice with:

```html
<button id="webPrint" data-printer="receipt_printer" data-print="#receipt">Print</button>
<span id="receipt">
  <h3>Hold at <<branches.branchname>></h3>
  <p>
    <<borrowers.surname>>, <<borrowers.firstname>> (<<borrowers.cardnumber>>)<br />
    Phone: <<borrowers.phone>>
  </p>
  <p>
    <<biblio.title>><br />
    Barcode: <<items.barcode>><br />
    Waiting since: <<reserves.waitingdate>>
  </p>
  <p>Pick up before: <<reserves.expirationdate>></p>
</span>
```

## Auto-print when the slip opens (IntranetSlipPrinterJS)

Set the `IntranetSlipPrinterJS` system preference to click the button as
soon as the slip window loads — the slip prints silently and staff never
see a print dialog:

```javascript
setTimeout(function () {
  $("#webPrint").trigger("click");
}, 1000);
```

## Opening a cash drawer

A button with `data-action="cash-drawer"` kicks open the till drawer
attached to the named printer instead of printing (no `data-print` needed).
Add it wherever staff take payments, e.g. via `IntranetUserJS` on the
paycollect page:

```html
<button class="olorinPlugin" data-action="cash-drawer" data-printer="receipt_printer">
  Open Drawer
</button>
```

## Alerting staff when printing fails (IntranetUserJS)

Silent printing means nobody sees an error dialog when a print job fails.
The extension reports every outcome as a DOM event — `olorin:print-result`
for print jobs and `olorin:drawer-result` for cash drawer kicks, both with
`{ success, error }` in `event.detail`. Add this to the `IntranetUserJS`
system preference to surface failures:

```javascript
["olorin:print-result", "olorin:drawer-result"].forEach(function (eventName) {
  document.addEventListener(eventName, function (event) {
    if (event.detail.success === false) {
      var what = eventName === "olorin:drawer-result" ? "Cash drawer" : "Printing";
      alert(what + " failed: " + (event.detail.error || "unknown error"));
    }
  });
});
```

Replace the `alert` with your preferred toast library if the staff client
already loads one.
