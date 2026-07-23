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
//
// Pages that prefer a programmatic API over synthesizing clicks can instead
// dispatch CustomEvents on the document (available from extension 2.1):
//   olorin:ping         detail { id? }                    -> olorin:pong
//   olorin:status       detail { id? }                    -> olorin:status-result
//   olorin:print        detail { id?, printer, selector | content, overrides... }
//                                                         -> olorin:print-result
//   olorin:kick-drawer  detail { id?, printer }           -> olorin:drawer-result
// A detail.id, when given, is echoed in the matching result event so
// concurrent requests can be correlated. Requests without an id produce
// results without one, exactly like button clicks.

const DEBUG = false;

// Per-job overrides an 'olorin:print' event may carry; they are copied into
// the printer-command payload verbatim.
const PRINT_OVERRIDE_FIELDS = [
  "copies",
  "duplex",
  "pageWidth",
  "pageHeight",
  "marginTop",
  "marginRight",
  "marginBottom",
  "marginLeft",
  "orientation",
];

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

document.addEventListener("olorin:ping", (event) => {
  const id = event.detail ? event.detail.id : undefined;
  dispatchResult(
    "olorin:pong",
    withRequestId({ version: chrome.runtime.getManifest().version }, id),
  );
});

document.addEventListener("olorin:status", (event) => {
  const id = event.detail ? event.detail.id : undefined;

  const message = {
    id: "hello",
    text: "hello",
  };

  // Companion apps before 2.0 never answer hello, so the proxy's timeout
  // error is what an old companion looks like.
  sendToCompanion(message, "olorin:status-result", { requestId: id, includeData: true });
});

document.addEventListener("olorin:print", (event) => {
  const detail = event.detail || {};
  const id = detail.id;

  if (!detail.printer) {
    dispatchResult(
      "olorin:print-result",
      withRequestId(
        { success: false, error: "The 'olorin:print' event detail is missing 'printer'" },
        id,
      ),
    );
    return;
  }

  let content = detail.content;
  if (detail.selector) {
    let target = null;
    try {
      target = document.querySelector(detail.selector);
    } catch {
      // An invalid selector matches no element
    }
    if (!target) {
      dispatchResult(
        "olorin:print-result",
        withRequestId(
          { success: false, error: `No element matches selector '${detail.selector}'` },
          id,
        ),
      );
      return;
    }
    content = target.innerHTML;
  } else if (content === undefined) {
    dispatchResult(
      "olorin:print-result",
      withRequestId(
        {
          success: false,
          error: "The 'olorin:print' event detail needs either 'selector' or 'content'",
        },
        id,
      ),
    );
    return;
  }

  const message = {
    id: "print",
    text: "printer-command",
    content: content,
    printer: detail.printer,
  };
  for (const field of PRINT_OVERRIDE_FIELDS) {
    if (detail[field] !== undefined) {
      message[field] = detail[field];
    }
  }

  sendToCompanion(message, "olorin:print-result", { requestId: id });
});

document.addEventListener("olorin:kick-drawer", (event) => {
  const detail = event.detail || {};
  const id = detail.id;

  if (!detail.printer) {
    dispatchResult(
      "olorin:drawer-result",
      withRequestId(
        { success: false, error: "The 'olorin:kick-drawer' event detail is missing 'printer'" },
        id,
      ),
    );
    return;
  }

  const message = {
    id: "kick",
    text: "kick-drawer",
    printer: detail.printer,
  };

  sendToCompanion(message, "olorin:drawer-result", { requestId: id });
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

function sendToCompanion(payload, eventName, { requestId, includeData } = {}) {
  chrome.runtime.sendMessage({ type: "websocket-send", payload }, (response) => {
    if (chrome.runtime.lastError) {
      dispatchResult(
        eventName,
        withRequestId({ success: false, error: chrome.runtime.lastError.message }, requestId),
      );
      return;
    }
    if (!response || !response.success) {
      dispatchResult(
        eventName,
        withRequestId(
          {
            success: false,
            error: (response && response.error) || "No response from the Companion App",
          },
          requestId,
        ),
      );
      return;
    }
    // The companion's own response reports whether the operation succeeded
    const data = response.data || {};
    const detail = { success: data.success !== false, error: data.error };
    if (includeData) {
      detail.data = data;
    }
    dispatchResult(eventName, withRequestId(detail, requestId));
  });
}

// Echo the requester's correlation id, but only when the request carried one
// — button clicks and id-less events keep the plain { success, error } shape.
function withRequestId(detail, requestId) {
  return requestId === undefined ? detail : { id: requestId, ...detail };
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
