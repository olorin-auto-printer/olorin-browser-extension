// Koha embeds print buttons in slips:
//   <button id="webPrint" data-printer="receipt_printer" data-print="#receipt">Print</button>
// (or any element with the 'olorinPlugin' class). On click, the HTML of the
// element selected by 'data-print' is sent to the Companion App, which
// resolves the logical printer key ('data-printer') from its saved settings
// and prints silently.
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
    dispatchResult({ success: false, error: `No element matches selector '${selector}'` });
    return;
  }

  const message = {
    id: "print",
    text: "printer-command",
    content: target.innerHTML,
    printer: printer,
  };

  chrome.runtime.sendMessage({ type: "websocket-send", payload: message }, (response) => {
    if (chrome.runtime.lastError) {
      dispatchResult({ success: false, error: chrome.runtime.lastError.message });
      return;
    }
    if (!response || !response.success) {
      dispatchResult({
        success: false,
        error: (response && response.error) || "No response from the Companion App",
      });
      return;
    }
    // The companion's own response reports whether the print job succeeded
    const data = response.data || {};
    dispatchResult({ success: data.success !== false, error: data.error });
  });
});

// Pages can listen for this to react to print outcomes:
//   document.addEventListener('olorin:print-result', (e) => console.log(e.detail))
function dispatchResult(detail) {
  if (DEBUG) {
    console.log("[olorin] print result", detail);
  }
  document.dispatchEvent(new CustomEvent("olorin:print-result", { detail }));
}
