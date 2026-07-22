// Web applications embed print buttons (Koha slips do this out of the box):
//   <button id="webPrint" data-printer="receipt_printer" data-print="#receipt">Print</button>
// (or any element with the 'olorinPlugin' class). On click, the HTML of the
// element selected by 'data-print' is sent to the Companion App, which
// resolves the logical printer key ('data-printer') from its saved settings
// and prints silently.
//
// A button with data-action="cash-drawer" instead asks the Companion App to
// kick open the till drawer attached to the printer named by 'data-printer'
// — no slip content is involved.
//
// The click handler is delegated so buttons injected after page load — and
// Koha's IntranetSlipPrinterJS auto-click — keep working.

const DEBUG = false;

document.addEventListener("click", (event) => {
  const button =
    event.target instanceof Element ? event.target.closest("#webPrint, .olorinPlugin") : null;
  if (!button) {
    return;
  }

  if (button.dataset.action === "cash-drawer") {
    kickDrawer(button);
    return;
  }

  printSlip(button);
});

function printSlip(button) {
  const printer = button.dataset.printer;
  const selector = button.dataset.print;
  if (!printer || !selector) {
    if (DEBUG) {
      console.warn("[olorin] print button is missing data-printer or data-print", button);
    }
    return;
  }

  const target = document.querySelector(selector);
  if (!target) {
    dispatchResult("olorin:print-result", {
      success: false,
      error: `No element matches selector '${selector}'`,
    });
    return;
  }

  const message = {
    id: "print",
    text: "printer-command",
    content: target.innerHTML,
    printer: printer,
  };

  sendToCompanion(message, "olorin:print-result");
}

function kickDrawer(button) {
  const printer = button.dataset.printer;
  if (!printer) {
    if (DEBUG) {
      console.warn("[olorin] cash drawer button is missing data-printer", button);
    }
    return;
  }

  const message = {
    id: "kick",
    text: "kick-drawer",
    printer: printer,
  };

  sendToCompanion(message, "olorin:drawer-result");
}

function sendToCompanion(payload, eventName) {
  chrome.runtime.sendMessage({ type: "websocket-send", payload }, (response) => {
    if (chrome.runtime.lastError) {
      dispatchResult(eventName, { success: false, error: chrome.runtime.lastError.message });
      return;
    }
    if (!response || !response.success) {
      dispatchResult(eventName, {
        success: false,
        error: (response && response.error) || "No response from the Companion App",
      });
      return;
    }
    // The companion's own response reports whether the operation succeeded
    const data = response.data || {};
    dispatchResult(eventName, { success: data.success !== false, error: data.error });
  });
}

// Pages can listen for these to react to outcomes:
//   document.addEventListener('olorin:print-result', (e) => console.log(e.detail))
//   document.addEventListener('olorin:drawer-result', (e) => console.log(e.detail))
function dispatchResult(eventName, detail) {
  if (DEBUG) {
    console.log(`[olorin] ${eventName}`, detail);
  }
  document.dispatchEvent(new CustomEvent(eventName, { detail }));
}
