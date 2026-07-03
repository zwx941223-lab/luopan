(function injectPageApiHook() {
  if (window.__DY_MONITOR_PAGE_HOOKED__) {
    return;
  }

  window.__DY_MONITOR_PAGE_HOOKED__ = true;

  function cloneHeaders(headers) {
    try {
      if (!headers) {
        return {};
      }

      if (headers instanceof Headers) {
        return Object.fromEntries(headers.entries());
      }

      if (Array.isArray(headers)) {
        return Object.fromEntries(headers);
      }

      return JSON.parse(JSON.stringify(headers));
    } catch {
      return {};
    }
  }

  function shouldCapture(url, bodyText) {
    const source = `${url || ""} ${bodyText || ""}`.toLowerCase();
    if (!source.includes("/compass_api/")) {
      return false;
    }
    if (/mcs\.zijieapi\.com|log|monitor|report|metrics/i.test(source)) {
      return false;
    }
    if (/\/shop\/product\/list|\/product\/list|commodity|product-list/i.test(source)) {
      return false;
    }
    return (
      source.includes("rank") ||
      source.includes("ranking") ||
      source.includes("board") ||
      source.includes("cate") ||
      source.includes("category") ||
      source.includes("industry") ||
      source.includes("aweme") ||
      source.includes("video") ||
      source.includes("content")
    );
  }

  function emit(detail) {
    window.dispatchEvent(
      new CustomEvent("dy-monitor:api-captured", {
        detail
      })
    );
  }

  async function tryReadJsonResponse(response) {
    try {
      const cloned = response.clone();
      const contentType = String(cloned.headers.get("content-type") || "").toLowerCase();
      if (!contentType.includes("json")) {
        return "";
      }
      return await cloned.text();
    } catch {
      return "";
    }
  }

  const originalFetch = window.fetch.bind(window);
  window.fetch = async function patchedFetch(input, init = {}) {
    const url = typeof input === "string" ? input : input?.url || "";
    const method = String(init?.method || input?.method || "GET").toUpperCase();
    const headers = cloneHeaders(init?.headers || input?.headers || {});
    const bodyText =
      typeof init?.body === "string"
        ? init.body
        : typeof input?.body === "string"
          ? input.body
          : "";

    const shouldTrack = shouldCapture(url, bodyText);
    const requestMeta = shouldTrack
      ? {
        url,
        method,
        headers,
        bodyText,
        capturedAt: Date.now(),
        source: "fetch"
      }
      : null;

    const response = await originalFetch(input, init);

    if (requestMeta) {
      requestMeta.responseText = await tryReadJsonResponse(response);
      emit(requestMeta);
    }

    return response;
  };

  const originalOpen = XMLHttpRequest.prototype.open;
  const originalSend = XMLHttpRequest.prototype.send;

  XMLHttpRequest.prototype.open = function patchedOpen(method, url, ...rest) {
    this.__dyMonitorMeta = {
      method: String(method || "GET").toUpperCase(),
      url: String(url || "")
    };
    return originalOpen.call(this, method, url, ...rest);
  };

  XMLHttpRequest.prototype.send = function patchedSend(body) {
    const url = this.__dyMonitorMeta?.url || "";
    const method = this.__dyMonitorMeta?.method || "GET";
    const bodyText = typeof body === "string" ? body : "";

    if (shouldCapture(url, bodyText)) {
      const capturedAt = Date.now();
      this.addEventListener(
        "loadend",
        () => {
          emit({
            url,
            method,
            headers: {},
            bodyText,
            responseText:
              typeof this.responseText === "string" && this.responseText.length <= 2_000_000
                ? this.responseText
                : "",
            capturedAt,
            source: "xhr"
          });
        },
        { once: true }
      );
    }

    return originalSend.call(this, body);
  };
})();
