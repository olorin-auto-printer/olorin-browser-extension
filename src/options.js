// Options page: maps the five logical printers Koha slips reference to real
// OS printers, with per-printer page size, margins, and orientation. All
// settings are stored by the Companion App (set-options / get-options over
// its WebSocket), so they are shared by every browser on the machine.

const FIELD_NAMES = [
  "full_sheet_printer",
  "full_sheet_printer_copies",
  "full_sheet_printer_duplex",
  "full_sheet_printer_height",
  "full_sheet_printer_margin_bottom",
  "full_sheet_printer_margin_left",
  "full_sheet_printer_margin_right",
  "full_sheet_printer_margin_top",
  "full_sheet_printer_orientation",
  "full_sheet_printer_width",
  "label_printer",
  "label_printer_copies",
  "label_printer_duplex",
  "label_printer_height",
  "label_printer_margin_bottom",
  "label_printer_margin_left",
  "label_printer_margin_right",
  "label_printer_margin_top",
  "label_printer_orientation",
  "label_printer_width",
  "paper_printer",
  "paper_printer_copies",
  "paper_printer_duplex",
  "paper_printer_height",
  "paper_printer_margin_bottom",
  "paper_printer_margin_left",
  "paper_printer_margin_right",
  "paper_printer_margin_top",
  "paper_printer_orientation",
  "paper_printer_width",
  "receipt_printer",
  "receipt_printer_copies",
  "receipt_printer_duplex",
  "receipt_printer_height",
  "receipt_printer_margin_bottom",
  "receipt_printer_margin_left",
  "receipt_printer_margin_right",
  "receipt_printer_margin_top",
  "receipt_printer_orientation",
  "receipt_printer_width",
  "sticker_printer",
  "sticker_printer_copies",
  "sticker_printer_duplex",
  "sticker_printer_height",
  "sticker_printer_margin_bottom",
  "sticker_printer_margin_left",
  "sticker_printer_margin_right",
  "sticker_printer_margin_top",
  "sticker_printer_orientation",
  "sticker_printer_width",
];

const PRINTER_SELECT_IDS = [
  "receipt_printer",
  "sticker_printer",
  "paper_printer",
  "full_sheet_printer",
  "label_printer",
];

const TOAST_MS = 3000;

let toastTimer;

// Missing keys resolve to "" in chrome.i18n, so the English fallback applies
function i18nMessage(key, fallback) {
  return (chrome.i18n && chrome.i18n.getMessage(key)) || fallback;
}

function sendWebSocketMessage(payload) {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage({ type: "websocket-send", payload }, (response) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
        return;
      }
      if (response && response.success) {
        resolve(response.data);
        return;
      }
      reject(new Error((response && response.error) || "No response from the Companion App"));
    });
  });
}

function showErrorBanner(visible) {
  document.getElementById("error-banner").classList.toggle("hide", !visible);
}

function showSavedToast() {
  const toast = document.getElementById("save-msg");
  toast.classList.remove("hide");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.add("hide"), TOAST_MS);
}

async function loadPrinters({ preserveSelections = false } = {}) {
  const data = await sendWebSocketMessage({ id: "printerList", text: "list-printer" });
  if (!data || data.id !== "printerList" || !Array.isArray(data.printer)) {
    throw new Error("Unexpected printer list response");
  }

  for (const selectId of PRINTER_SELECT_IDS) {
    const select = document.getElementById(selectId);
    const previous = select.value;

    select.replaceChildren();
    const placeholder = document.createElement("option");
    placeholder.value = "";
    placeholder.textContent = i18nMessage("optionsSelect", "Select");
    select.append(placeholder);

    for (const printer of data.printer) {
      const option = document.createElement("option");
      option.value = printer.name;
      option.textContent = printer.name;
      select.append(option);
    }

    if (preserveSelections && previous) {
      select.value = previous;
    }
  }
}

async function loadSavedOptions() {
  const data = await sendWebSocketMessage({ id: "get-options", text: "get-options" });
  for (const fieldName of FIELD_NAMES) {
    const field = document.getElementsByName(fieldName)[0];
    const value = data && data[fieldName];
    if (field && value !== undefined && value !== null) {
      field.value = value;
    }
  }
}

async function saveOptions(event) {
  event.preventDefault();

  const options = {};
  for (const fieldName of FIELD_NAMES) {
    options[fieldName] = document.getElementsByName(fieldName)[0].value;
  }

  try {
    await sendWebSocketMessage({ id: "set-options", text: "set-options", options });
    showErrorBanner(false);
    showSavedToast();
  } catch {
    showErrorBanner(true);
  }
}

async function refreshPrinters() {
  try {
    await loadPrinters({ preserveSelections: true });
    showErrorBanner(false);
  } catch {
    showErrorBanner(true);
  }
}

async function init() {
  document.getElementById("printer").addEventListener("submit", saveOptions);
  document.getElementById("refresh").addEventListener("click", refreshPrinters);

  try {
    await loadPrinters();
    await loadSavedOptions();
    showErrorBanner(false);
  } catch {
    showErrorBanner(true);
  }
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}
