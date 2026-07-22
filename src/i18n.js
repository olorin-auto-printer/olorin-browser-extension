// Applies _locales translations to annotated elements. The HTML keeps the
// English text as a fallback; an element is only touched when the message
// key actually resolves (chrome.i18n.getMessage returns "" for missing
// keys, like the real API).
//
//   data-i18n="key"             replaces textContent (or value, for inputs)
//   data-i18n-placeholder="key" replaces the placeholder attribute

function applyTranslations() {
  for (const element of document.querySelectorAll("[data-i18n]")) {
    const message = chrome.i18n.getMessage(element.dataset.i18n);
    if (!message) {
      continue;
    }
    // The printer row labels are disabled text inputs, so their visible
    // text lives in 'value' rather than in a text node
    if (element instanceof HTMLInputElement) {
      element.value = message;
    } else {
      element.textContent = message;
    }
  }

  for (const element of document.querySelectorAll("[data-i18n-placeholder]")) {
    const message = chrome.i18n.getMessage(element.dataset.i18nPlaceholder);
    if (message) {
      element.placeholder = message;
    }
  }
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", applyTranslations);
} else {
  applyTranslations();
}
