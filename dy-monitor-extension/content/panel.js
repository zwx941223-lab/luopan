(function registerDyMonitorPanel() {
  const runtime = window.__DY_MONITOR_RUNTIME__;
  if (!runtime || document.querySelector("#dy-monitor-root")) return;

  const VERSION = runtime.config.version || "plugin-v4.0.0";
  const TIMER_INTERVAL_MS = 90 * 60 * 1000;
  const sleep = (ms) => new Promise((resolve) => window.setTimeout(resolve, ms));
  const t = {
    title: "\u77ed\u89c6\u9891\u699c\u5355\u91c7\u96c6",
    subtitle: "\u56fa\u5b9a\u91c7\u96c6\u77ed\u89c6\u9891\u699c / \u5b9e\u65f6 / Top100",
    selectAll: "\u5168\u9009",
    clear: "\u6e05\u7a7a",
    runSelected: "\u7acb\u5373\u6267\u884c\u4e00\u8f6e",
    runAll: "\u5168\u7c7b\u76ee\u91c7\u96c6",
    timerOn: "\u670d\u52a1\u5668\u5b9a\u65f6\uff1a90\u5206\u949f/\u8f6e",
    timerOff: "\u5173\u95ed\u5b9a\u65f6",
    stop: "\u505c\u6b62\u4efb\u52a1",
    waiting: "\u7b49\u5f85\u5f00\u59cb\u3002",
    pickFirst: "\u670d\u52a1\u5668\u6a21\u5f0f\u56fa\u5b9a\u91c7\u96c6\u5168\u7c7b\u76ee\u3002",
    timerStarted: "\u670d\u52a1\u5668\u5b9a\u65f6\u5df2\u5f00\u542f\uff1a\u7acb\u5373\u6267\u884c\u4e00\u8f6e\uff0c\u4e4b\u540e\u6bcf90\u5206\u949f\u81ea\u52a8\u5168\u7c7b\u76ee\u91c7\u96c6\u3002",
    timerStopped: "\u5b9a\u65f6\u5df2\u5173\u95ed\u3002",
    uploadFailed: "\u4e0a\u4f20\u5931\u8d25",
    noData: "\u6ca1\u6709\u8bfb\u53d6\u5230\u699c\u5355\u6570\u636e",
    switchFailed: "\u7c7b\u76ee\u5207\u6362\u5931\u8d25",
    stopping: "\u6b63\u5728\u505c\u6b62\uff0c\u5f53\u524d\u7c7b\u76ee\u7ed3\u675f\u540e\u9000\u51fa\u3002"
  };

  const root = document.createElement("div");
  root.id = "dy-monitor-root";
  root.innerHTML = `
    <style>
      #dy-monitor-root{position:fixed;right:16px;bottom:16px;z-index:2147483647;font-family:Arial,"Microsoft YaHei",sans-serif;color:#172033}
      .dy-card{width:330px;max-height:78vh;overflow:auto;background:#fff;border:1px solid #e6ebf2;border-radius:14px;box-shadow:0 18px 48px rgba(15,23,42,.18);padding:12px}
      .dy-title{display:flex;align-items:center;justify-content:space-between;font-weight:800;font-size:14px;margin-bottom:8px}
      .dy-ver{font-size:11px;color:#667085;font-weight:500}
      .dy-row{display:grid;gap:8px;margin:8px 0}
      .dy-btn{border:0;border-radius:9px;padding:9px 10px;font-weight:700;cursor:pointer;background:#edf8f6;color:#08776d}
      .dy-btn.primary{background:#0f766e;color:#fff}
      .dy-btn.dark{background:#172033;color:#fff}
      .dy-btn.warn{background:#fff7ed;color:#c2410c}
      .dy-btn.danger{background:#fee4e2;color:#b42318}
      .dy-btn:disabled{opacity:.55;cursor:not-allowed}
      .dy-progress{height:7px;background:#eef2f7;border-radius:99px;overflow:hidden}
      .dy-progress>span{display:block;height:100%;width:0;background:#0f766e;transition:width .2s}
      .dy-status{font-size:12px;line-height:1.5;color:#475467;white-space:pre-wrap}
      .dy-list{max-height:250px;overflow:auto;border:1px solid #edf1f6;border-radius:10px;padding:7px;display:grid;gap:7px}
      .dy-cat{display:grid;grid-template-columns:auto 1fr;gap:6px 8px;align-items:center;font-size:12px;color:#344054}
      .dy-cat label{font-weight:800}
      .dy-cat select{grid-column:2;width:100%;min-width:0;border:1px solid #d9e1ec;border-radius:8px;padding:6px;color:#344054;background:#fff;font-size:12px}
      .dy-actions{display:grid;grid-template-columns:1fr 1fr;gap:8px}
      .dy-small{font-size:11px;color:#98a2b3}
    </style>
    <div class="dy-card">
      <div class="dy-title">
        <span>${t.title}</span>
        <span class="dy-ver">${VERSION}</span>
      </div>
      <div class="dy-small">${t.subtitle}</div>
      <div class="dy-row dy-actions">
        <button class="dy-btn" id="dy-select-all">${t.selectAll}</button>
        <button class="dy-btn" id="dy-clear">${t.clear}</button>
      </div>
      <div class="dy-list" id="dy-category-list"></div>
      <div class="dy-row dy-actions">
        <button class="dy-btn primary" id="dy-run-selected">${t.runSelected}</button>
        <button class="dy-btn dark" id="dy-run-all">${t.runAll}</button>
      </div>
      <button class="dy-btn warn" id="dy-timer" style="width:100%">${t.timerOn}</button>
      <button class="dy-btn danger" id="dy-stop" style="width:100%;display:none">${t.stop}</button>
      <div class="dy-progress"><span id="dy-progress-bar"></span></div>
      <div class="dy-status" id="dy-status">${t.waiting}</div>
    </div>
  `;
  document.documentElement.appendChild(root);

  const list = root.querySelector("#dy-category-list");
  const status = root.querySelector("#dy-status");
  const bar = root.querySelector("#dy-progress-bar");
  const runSelected = root.querySelector("#dy-run-selected");
  const runAll = root.querySelector("#dy-run-all");
  const timerButton = root.querySelector("#dy-timer");
  const stopButton = root.querySelector("#dy-stop");
  let stopRequested = false;
  let timerId = null;
  let running = false;

  function setStatus(message) {
    status.textContent = message;
  }

  function setProgress(done, total) {
    const percent = total ? Math.round((done / total) * 100) : 0;
    bar.style.width = `${Math.max(0, Math.min(100, percent))}%`;
  }

  function categories() {
    return runtime.silentCapture?.getStandardCategories?.() || [];
  }

  function groupedCategories() {
    const map = new Map();
    categories().forEach((item) => {
      const level1 = item.level1 || item.name.split("/")[0] || item.name;
      if (!map.has(level1)) map.set(level1, []);
      map.get(level1).push(item);
    });
    return [...map.entries()];
  }

  function renderCategories() {
    list.innerHTML = groupedCategories().map(([level1, rows], index) => `
      <div class="dy-cat">
        <input type="checkbox" id="dy-cat-${index}" data-level1="${level1}">
        <label for="dy-cat-${index}">${level1}</label>
        <select data-level1="${level1}">
          ${rows.map((item) => `<option value="${item.id}" data-name="${item.name}">${item.level2 || item.name.split("/").slice(1).join("/") || item.name}</option>`).join("")}
        </select>
      </div>
    `).join("");
  }

  function selectedCategories() {
    return Array.from(list.querySelectorAll(".dy-cat"))
      .filter((row) => row.querySelector("input")?.checked)
      .map((row) => {
        const select = row.querySelector("select");
        const option = select?.selectedOptions?.[0];
        return {
          categoryId: select?.value || "",
          categoryName: option?.dataset.name || ""
        };
      })
      .filter((item) => item.categoryId && item.categoryName);
  }

  function allCategories() {
    return categories().map((item) => ({ categoryId: item.id, categoryName: item.name }));
  }

  function setBusy(busy) {
    running = busy;
    runSelected.disabled = busy;
    runAll.disabled = busy;
    timerButton.disabled = busy && !timerId;
    stopButton.style.display = busy ? "block" : "none";
  }

  function upload(records, meta) {
    return new Promise((resolve, reject) => {
      chrome.runtime.sendMessage(
        {
          type: "upload-capture",
          apiBaseUrl: runtime.config.apiBaseUrl,
          extensionToken: runtime.config.extensionToken,
          payload: { ...meta, records }
        },
        (response) => {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
            return;
          }
          if (!response?.ok) {
            reject(new Error(response?.message || t.uploadFailed));
            return;
          }
          resolve(response.data);
        }
      );
    });
  }

  async function collectOne(category, index, total) {
    setStatus(`(${index}/${total}) \u5207\u6362\u7c7b\u76ee\uff1a${category.categoryName}`);
    const switched = await runtime.silentCapture.switchToCategory(category);
    if (!switched?.ok) throw new Error(switched?.message || t.switchFailed);

    setStatus(`(${index}/${total}) \u5f00\u59cb\u91c7\u96c6\uff1a${category.categoryName}`);
    const result = await runtime.silentCapture.collectSilently({
      categoryId: category.categoryId,
      categoryName: category.categoryName,
      pageLimit: runtime.config.pageLimit || 10
    });
    if (!result.records.length) throw new Error(t.noData);

    setStatus(`(${index}/${total}) \u4e0a\u4f20 ${result.records.length} \u6761\uff1a${category.categoryName}`);
    await upload(result.records, {
      categoryId: category.categoryId,
      categoryName: category.categoryName,
      rankingType: runtime.config.rankingType || "\u77ed\u89c6\u9891\u699c",
      sourceUrl: location.href,
      captureSchemaVersion: 4,
      pageLimit: runtime.config.pageLimit || 10,
      triggerMode: "plugin-v4",
      capturedAt: new Date().toISOString(),
      latestApiCapturedAt: Date.now()
    });
    return result.records.length;
  }

  async function runBatch(rows, source = "manual") {
    if (running) return;
    if (!rows.length) {
      setStatus(t.pickFirst);
      return;
    }
    setBusy(true);
    stopRequested = false;
    setProgress(0, rows.length);
    let success = 0;
    let failed = 0;
    const failedRows = [];
    try {
      for (let i = 0; i < rows.length; i += 1) {
        if (stopRequested) break;
        try {
          const count = await collectOne(rows[i], i + 1, rows.length);
          success += 1;
          setStatus(`${source === "timer" ? "\u5b9a\u65f6" : "\u624b\u52a8"}\u5b8c\u6210 ${rows[i].categoryName}\uff1a${count} \u6761\n\u6210\u529f ${success}\uff0c\u5931\u8d25 ${failed}`);
        } catch (error) {
          failed += 1;
          failedRows.push(`${rows[i].categoryName}: ${error.message}`);
          setStatus(`\u5931\u8d25 ${rows[i].categoryName}: ${error.message}\n\u6210\u529f ${success}\uff0c\u5931\u8d25 ${failed}`);
        }
        setProgress(i + 1, rows.length);
        await sleep(600);
      }
      setStatus(`\u4efb\u52a1\u7ed3\u675f\u3002\u6210\u529f ${success}\uff0c\u5931\u8d25 ${failed}${failedRows.length ? `\n${failedRows.join("\n")}` : ""}`);
    } finally {
      setBusy(false);
    }
  }

  function stopTimer() {
    if (timerId) {
      window.clearInterval(timerId);
      timerId = null;
    }
    timerButton.textContent = t.timerOn;
    setStatus(t.timerStopped);
  }

  function startTimer() {
    const runTimerRound = () => runBatch(allCategories(), "timer");
    setStatus(t.timerStarted);
    timerButton.textContent = t.timerOff;
    runTimerRound();
    timerId = window.setInterval(runTimerRound, TIMER_INTERVAL_MS);
  }

  root.querySelector("#dy-select-all").addEventListener("click", () => {
    list.querySelectorAll("input").forEach((input) => { input.checked = true; });
  });
  root.querySelector("#dy-clear").addEventListener("click", () => {
    list.querySelectorAll("input").forEach((input) => { input.checked = false; });
  });
  runSelected.addEventListener("click", () => runBatch(selectedCategories()));
  runAll.addEventListener("click", () => runBatch(allCategories()));
  timerButton.addEventListener("click", () => {
    if (timerId) {
      stopTimer();
      return;
    }
    startTimer();
  });
  stopButton.addEventListener("click", () => {
    stopRequested = true;
    setStatus(t.stopping);
  });

  renderCategories();
  window.setTimeout(() => {
    if (!timerId) startTimer();
  }, 3000);
})();
