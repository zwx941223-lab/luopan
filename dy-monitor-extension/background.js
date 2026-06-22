chrome.runtime.onInstalled.addListener(() => {
  console.log("[DY Monitor] extension installed");
});

if (chrome.runtime.onStartup) {
  chrome.runtime.onStartup.addListener(() => {
    console.log("[DY Monitor] service worker started");
  });
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === "ping") {
    sendResponse({ ok: true, source: "background" });
    return true;
  }

  if (message?.type === "open-dashboard") {
    chrome.tabs.create({ url: message.url || "http://localhost:5173" });
    sendResponse({ ok: true });
    return true;
  }

  if (message?.type === "upload-capture") {
    fetch(`${message.apiBaseUrl}/monitor/capture/upload`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-extension-token": message.extensionToken
      },
      body: JSON.stringify(message.payload)
    })
      .then(async (response) => {
        if (!response.ok) {
          const error = await response.json().catch(() => ({ message: "Upload failed" }));
          sendResponse({ ok: false, message: error.message || "Upload failed" });
          return;
        }

        const data = await response.json().catch(() => ({}));
        sendResponse({
          ok: true,
          data,
          uploadMs: Number(response.headers.get("X-DY-Monitor-Upload-Ms") || 0)
        });
      })
      .catch((error) => {
        sendResponse({ ok: false, message: error.message || "Upload failed" });
      });

    return true;
  }

  if (message?.type === "auto-capture-state") {
    fetch(`${message.apiBaseUrl}/monitor/capture/auto-state`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-extension-token": message.extensionToken
      },
      body: JSON.stringify(message.payload || {})
    })
      .then(async (response) => {
        const data = await response.json().catch(() => ({}));
        sendResponse(response.ok ? { ok: true, data } : { ok: false, message: data.message || "State update failed" });
      })
      .catch((error) => {
        sendResponse({ ok: false, message: error.message || "State update failed" });
      });

    return true;
  }

  if (message?.type === "capture-timing") {
    fetch(`${message.apiBaseUrl}/monitor/capture/timing`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-extension-token": message.extensionToken
      },
      body: JSON.stringify(message.payload || {})
    })
      .then(async (response) => {
        const data = await response.json().catch(() => ({}));
        sendResponse(response.ok ? { ok: true, data } : { ok: false, message: data.message || "Timing update failed" });
      })
      .catch((error) => {
        sendResponse({ ok: false, message: error.message || "Timing update failed" });
      });

    return true;
  }

  sendResponse({ ok: false });
  return false;
});
