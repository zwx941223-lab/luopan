(function injectPageApiHook() {
  if (window.__DY_MONITOR_PAGE_HOOKED__) {
    return;
  }

  window.__DY_MONITOR_PAGE_HOOKED__ = true;

  const COMPONENT_SELECT_REQUEST = "dy-monitor:component-menu-select";
  const COMPONENT_SELECT_RESPONSE = "dy-monitor:component-menu-selected";

  function componentEvent(type, target, currentTarget) {
    const pressed = type === "pointerdown" || type === "mousedown";
    const rect = currentTarget.getBoundingClientRect();
    const clientX = Math.round(rect.left + rect.width / 2);
    const clientY = Math.round(rect.top + rect.height / 2);
    return {
      type,
      target,
      currentTarget,
      button: 0,
      buttons: pressed ? 1 : 0,
      clientX,
      clientY,
      pointerId: 1,
      pointerType: "mouse",
      isPrimary: true,
      nativeEvent: {
        type,
        target,
        currentTarget,
        button: 0,
        buttons: pressed ? 1 : 0,
        clientX,
        clientY,
        pointerId: 1,
        pointerType: "mouse",
        isPrimary: true
      },
      preventDefault() {},
      stopPropagation() {},
      persist() {},
      isDefaultPrevented: () => false,
      isPropagationStopped: () => false
    };
  }

  function reactProps(element) {
    const propsKey = Object.getOwnPropertyNames(element).find((key) => key.startsWith("__reactProps$"));
    return propsKey ? element[propsKey] : null;
  }

  async function invokeComponentInteraction(target, menuItem, interaction) {
    const path = [];
    let current = target;
    while (current && (current === menuItem || menuItem.contains(current))) {
      path.push(current);
      if (current === menuItem) break;
      current = current.parentElement;
    }
    const candidates = [];
    const addCandidate = (element) => {
      if (element && !candidates.includes(element)) candidates.push(element);
    };
    addCandidate(menuItem);
    path.filter((element) => element !== menuItem).reverse().forEach(addCandidate);
    Array.from(menuItem.querySelectorAll?.("*") || []).forEach(addCandidate);
    const sequence = interaction === "expand"
      ? [
        ["onPointerOver", "pointerover"],
        ["onPointerEnter", "pointerenter"],
        ["onMouseOver", "mouseover"],
        ["onMouseEnter", "mouseenter"],
        ["onPointerMove", "pointermove"],
        ["onMouseMove", "mousemove"]
      ]
      : interaction === "select"
        ? [["onClick", "click"]]
        : [];
    let invoked = 0;
    for (const [handlerName, eventType] of sequence) {
      const owner = candidates.find((element) => typeof reactProps(element)?.[handlerName] === "function");
      if (!owner) continue;
      const eventTarget = owner === menuItem ? target : owner;
      await Promise.resolve(reactProps(owner)[handlerName](componentEvent(eventType, eventTarget, owner)));
      invoked += 1;
    }
    return invoked;
  }

  function emitComponentSelectResult(requestId, ok, message = "") {
    window.dispatchEvent(
      new CustomEvent(COMPONENT_SELECT_RESPONSE, {
        detail: JSON.stringify({ requestId, ok, message })
      })
    );
  }

  window.addEventListener(COMPONENT_SELECT_REQUEST, (event) => {
    let request = null;
    try {
      request = JSON.parse(String(event?.detail || ""));
    } catch {
      return;
    }
    const requestId = String(request?.requestId || "");
    const interaction = String(request?.interaction || "");
    const target = event?.target instanceof Element ? event.target : null;
    const menuItem = target?.closest?.(
      ".ecom-cascader-menu-item,[class*='menu-item'],[role='option'],[role='menuitem'],li"
    );
    if (!requestId || !["expand", "select"].includes(interaction) || !target || !menuItem) {
      emitComponentSelectResult(requestId, false, "Category component target is unavailable");
      return;
    }

    invokeComponentInteraction(target, menuItem, interaction)
      .then((invoked) => emitComponentSelectResult(
        requestId,
        invoked > 0,
        invoked > 0 ? "" : "Category component interaction callbacks are unavailable"
      ))
      .catch((error) => emitComponentSelectResult(requestId, false, error?.message || "Category callback failed"));
  });

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
