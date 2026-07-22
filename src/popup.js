// Popup: shows Companion App connection status and links to the options page.
// On Firefox, host permissions are user-grantable and may have been declined
// at install time — if so, a card with a grant button is shown instead.

function showCard(id) {
  // Cards default to display:none in the stylesheet to avoid a flash of all
  // four before this script runs.
  for (const card of document.querySelectorAll(".card")) {
    card.style.display = card.id === id ? "inline-block" : "none";
  }
}

function hasHostAccess() {
  return new Promise((resolve) => {
    if (!chrome.permissions || !chrome.permissions.contains) {
      resolve(true);
      return;
    }
    chrome.permissions.contains({ origins: ["<all_urls>"] }, (result) => resolve(Boolean(result)));
  });
}

function checkConnection() {
  chrome.runtime.sendMessage({ type: "websocket-check" }, (response) => {
    if (chrome.runtime.lastError || !response || !response.connected) {
      showCard("not_connected");
      return;
    }
    showCard("connected");
  });
}

async function init() {
  showCard("connecting");

  for (const button of document.querySelectorAll(".option-btn")) {
    if (button.id === "grant_permission") {
      continue;
    }
    button.addEventListener("click", (event) => {
      event.preventDefault();
      chrome.runtime.openOptionsPage();
    });
  }

  document.getElementById("grant_permission").addEventListener("click", (event) => {
    event.preventDefault();
    chrome.permissions.request({ origins: ["<all_urls>"] }, (granted) => {
      if (granted) {
        checkConnection();
      }
    });
  });

  if (!(await hasHostAccess())) {
    showCard("needs_permission");
    return;
  }

  checkConnection();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}
