(function bootstrapDyMonitorRuntime() {
  if (window.__DY_MONITOR_RUNTIME__) return;

  const config = window.DY_MONITOR_CONFIG || {};
  const runtime = {
    config,
    state: {
      pageLimit: Number(config.pageLimit || 10),
      latestCategoryDebug: null,
      latestCaptureDiagnostics: null,
      latestApiRequest: null,
      latestApiCapturedAt: 0,
      apiCandidates: []
    },
    silentCapture: null
  };

  window.__DY_MONITOR_RUNTIME__ = runtime;

  window.addEventListener("dy-monitor:api-captured", (event) => {
    const detail = event?.detail || {};
    if (!detail.url) return;
    const item = {
      url: detail.url,
      method: detail.method || "GET",
      headers: detail.headers || {},
      bodyText: detail.bodyText || "",
      responseText: detail.responseText || "",
      source: detail.source || "page",
      capturedAt: detail.capturedAt || Date.now()
    };
    runtime.state.latestApiRequest = item;
    runtime.state.latestApiCapturedAt = item.capturedAt;
    runtime.state.apiCandidates = [item, ...(runtime.state.apiCandidates || [])].slice(0, 50);
  });

  const hookUrl = chrome.runtime.getURL("content/page-api-hook.js");
  if (!document.querySelector(`script[data-dy-monitor-hook="${hookUrl}"]`)) {
    const script = document.createElement("script");
    script.src = hookUrl;
    script.async = false;
    script.dataset.dyMonitorHook = hookUrl;
    (document.head || document.documentElement).appendChild(script);
    script.addEventListener("load", () => script.remove(), { once: true });
  }
})();
