(function registerDyMonitorCapture() {
  const runtime = window.__DY_MONITOR_RUNTIME__;
  if (!runtime) return;

  const LABELS = {
    ranking: "\u77ed\u89c6\u9891\u699c",
    realtime: "\u5b9e\u65f6",
    category: "\u884c\u4e1a\u7c7b\u76ee"
  };

  const sleep = (ms) => new Promise((resolve) => window.setTimeout(resolve, ms));
  const text = (node) => String(node?.innerText || node?.textContent || "").replace(/\s+/g, " ").trim();
  const compact = (value) => String(value || "").replace(/\s+/g, "").trim();
  const sameCompactText = (left, right) => compact(left) === compact(right);
  const visible = (node) => {
    if (!node || node.closest?.("#dy-monitor-root")) return false;
    const rect = node.getBoundingClientRect?.();
    if (!rect || rect.width < 1 || rect.height < 1) return false;
    const style = window.getComputedStyle(node);
    return style.display !== "none" && style.visibility !== "hidden";
  };

  function click(node) {
    if (!node) return false;
    const rect = node.getBoundingClientRect();
    const base = {
      bubbles: true,
      cancelable: true,
      view: window,
      clientX: Math.round(rect.left + rect.width / 2),
      clientY: Math.round(rect.top + rect.height / 2)
    };
    try {
      ["pointerover", "pointerenter", "pointerdown", "pointerup"].forEach((type) => {
        node.dispatchEvent(new PointerEvent(type, { ...base, pointerId: 1, pointerType: "mouse", isPrimary: true }));
      });
    } catch {
      // PointerEvent is not required for older Chromium builds.
    }
    ["mouseover", "mousemove", "mousedown", "mouseup", "click"].forEach((type) => {
      node.dispatchEvent(new MouseEvent(type, base));
    });
    try {
      node.click();
    } catch {
      // Some framework wrapper nodes do not expose native click.
    }
    return true;
  }

  function fullClick(node) {
    return click(node);
  }

  function getCategories() {
    const dynamic = Array.isArray(runtime.state.dynamicCategories) ? runtime.state.dynamicCategories : [];
    if (dynamic.length) return dynamic;
    return Array.isArray(window.DY_MONITOR_STANDARD_CATEGORIES) ? window.DY_MONITOR_STANDARD_CATEGORIES : [];
  }

  function safeJson(value) {
    try {
      return value ? JSON.parse(value) : null;
    } catch {
      return null;
    }
  }

  function directValue(input, keys) {
    if (!input || typeof input !== "object" || Array.isArray(input)) return "";
    for (const key of keys) {
      const found = Object.entries(input).find(([name]) => String(name).toLowerCase() === key.toLowerCase());
      if (found && found[1] != null && typeof found[1] !== "object") return String(found[1]).trim();
    }
    return "";
  }

  function categoryNodeName(node) {
    return directValue(node, [
      "name",
      "label",
      "title",
      "categoryName",
      "category_name",
      "cateName",
      "cate_name",
      "industryName",
      "industry_name"
    ]);
  }

  function categoryNodeId(node) {
    return directValue(node, [
      "categoryId",
      "category_id",
      "cateId",
      "cate_id",
      "secondCateId",
      "second_cate_id",
      "id",
      "value"
    ]);
  }

  function industryNodeId(node) {
    return directValue(node, [
      "industryId",
      "industry_id",
      "firstCateId",
      "first_cate_id",
      "parentId",
      "parent_id",
      "id",
      "value"
    ]);
  }

  function childArrays(node) {
    if (!node || typeof node !== "object" || Array.isArray(node)) return [];
    return Object.entries(node)
      .filter(([key, value]) => /children|child|list|items|subs|category|cate/i.test(key) && Array.isArray(value))
      .map(([, value]) => value);
  }

  function normalizeCategoryRows(rows) {
    const map = new Map();
    rows.forEach((row) => {
      const id = String(row.id || "").trim();
      const level1 = String(row.level1 || "").trim();
      const level2 = String(row.level2 || "").trim();
      if (!id || !level1 || !level2 || level2 === "\u5168\u90e8") return;
      const key = `${id}|${level1}|${level2}`;
      if (!map.has(key)) {
        map.set(key, {
          id,
          name: row.name || `${level1}/${level2}`,
          level1,
          level2,
          industryId: String(row.industryId || "").trim(),
          source: row.source || "compass"
        });
      }
    });
    return Array.from(map.values()).sort((a, b) =>
      a.level1.localeCompare(b.level1, "zh-Hans-CN") ||
      a.level2.localeCompare(b.level2, "zh-Hans-CN")
    );
  }

  function categoriesFromPayload(payload, source = "") {
    const rows = [];
    const visit = (node, ancestors = []) => {
      if (!node || typeof node !== "object") return;
      if (Array.isArray(node)) {
        node.forEach((item) => visit(item, ancestors));
        return;
      }
      const name = categoryNodeName(node);
      const id = categoryNodeId(node);
      const children = childArrays(node).flat().filter((item) => item && typeof item === "object");
      if (ancestors.length && name && id) {
        const parent = ancestors[ancestors.length - 1];
        rows.push({
          id,
          level1: parent.name,
          level2: name,
          name: `${parent.name}/${name}`,
          industryId: parent.industryId || parent.id,
          source
        });
      }
      const nextAncestors = name
        ? [...ancestors, { name, id, industryId: industryNodeId(node) || id }]
        : ancestors;
      children.forEach((child) => visit(child, nextAncestors));
    };
    visit(payload, []);
    return normalizeCategoryRows(rows);
  }

  async function syncCategoryCatalog() {
    const now = Date.now();
    if (!runtime.state.categoryCatalogProbeAt || now - Number(runtime.state.categoryCatalogProbeAt || 0) > 30000) {
      runtime.state.categoryCatalogProbeAt = now;
      const urls = (performance.getEntriesByType?.("resource") || [])
        .map((entry) => entry.name)
        .filter((url) => /\/compass_api\//i.test(url))
        .filter((url) => /cate|category|industry/i.test(url))
        .slice(-8);
      for (const url of urls) {
        try {
          const response = await fetch(url, { credentials: "include", headers: { accept: "application/json, text/plain, */*" } });
          const candidate = {
            url,
            method: "GET",
            headers: {},
            bodyText: "",
            responseText: await response.text(),
            source: "category-probe",
            capturedAt: Date.now(),
            status: response.status
          };
          runtime.state.apiCandidates = [candidate, ...(runtime.state.apiCandidates || [])].slice(0, 50);
        } catch {
          // The catalog is opportunistic; failed probes keep the fallback category list.
        }
      }
    }
    const rows = [];
    (runtime.state.apiCandidates || []).forEach((candidate) => {
      const source = `${candidate.url || ""} ${candidate.bodyText || ""}`.toLowerCase();
      if (!/cate|category|industry/.test(source)) return;
      rows.push(...categoriesFromPayload(safeJson(candidate.responseText), candidate.url || "api"));
    });
    const normalized = normalizeCategoryRows(rows);
    if (normalized.length >= 5) {
      runtime.state.dynamicCategories = normalized;
      runtime.state.latestCategoryCatalog = {
        count: normalized.length,
        level1Count: new Set(normalized.map((item) => item.level1)).size,
        syncedAt: Date.now()
      };
      window.dispatchEvent(new CustomEvent("dy-monitor:categories-updated", { detail: runtime.state.latestCategoryCatalog }));
    }
    return runtime.state.dynamicCategories || [];
  }

  function findTopButton(label) {
    const target = compact(label);
    return Array.from(document.querySelectorAll("button,a,li,[role='tab'],[role='button'],span,div"))
      .filter(visible)
      .map((node) => ({
        node: node.closest("button,a,li,[role='tab'],[role='button']") || node,
        label: compact(text(node)),
        rect: node.getBoundingClientRect()
      }))
      .filter((item) => item.label === target && item.rect.top >= 0 && item.rect.top <= Math.max(230, innerHeight * 0.3))
      .sort((a, b) => a.rect.top - b.rect.top || a.rect.left - b.rect.left)[0]?.node || null;
  }

  async function ensureTopButton(label, waitMs = 500) {
    const button = findTopButton(label);
    if (!button) return false;
    const selected = !!button.closest("[aria-selected='true'],[aria-current='page'],[class*='active'],[class*='current'],[class*='selected'],[class*='checked']");
    if (!selected) {
      click(button);
      await sleep(waitMs);
    }
    return true;
  }

  function sameRow(leftRect, rightRect) {
    const leftMid = leftRect.top + leftRect.height / 2;
    const rightMid = rightRect.top + rightRect.height / 2;
    return Math.abs(leftMid - rightMid) <= Math.max(24, leftRect.height * 1.8);
  }

  function categoryPicker() {
    const label = Array.from(document.querySelectorAll("span,div,label"))
      .filter(visible)
      .find((node) => compact(text(node)) === compact(LABELS.category));
    const baseSelector = [
      ".ecom-cascader-picker",
      "[class*='cascader']",
      "[role='combobox']",
      "[aria-haspopup]",
      "[class*='select'][class*='selector']",
      "[class*='select'][class*='selection']",
      "[class*='picker']",
      "input[readonly]",
      "button",
      "span",
      "div"
    ].join(",");
    const isLikelyCategoryPicker = (item) =>
      item.label.includes("/") ||
      getCategories().some((cat) => {
        const level1 = compact(cat.level1 || cat.name.split("/")[0] || "");
        const level2 = compact(cat.level2 || cat.name.split("/").slice(1).join("/") || cat.name);
        const value = compact(item.label);
        return (level1 && value.includes(level1)) || (level2 && value.includes(level2));
      });
    const interactiveScore = (node) => {
      const signature = [
        node.tagName,
        node.className,
        node.getAttribute?.("role"),
        node.getAttribute?.("aria-haspopup"),
        node.getAttribute?.("placeholder")
      ].join(" ").toLowerCase();
      if (/cascader|combobox|select|selector|selection|picker|trigger/.test(signature)) return 0;
      if (/button|aria-haspopup/.test(signature)) return 1;
      return 2;
    };
    const isBadCategoryCandidate = (item) => {
      const value = compact(item.label);
      const signature = [
        value,
        item.node.className,
        item.node.getAttribute?.("placeholder"),
        item.node.getAttribute?.("aria-label")
      ].join(" ").toLowerCase();
      if (!value && interactiveScore(item.node) > 1) return true;
      if (value === compact(LABELS.category)) return true;
      if (/搜索|请输入|商品名|search|keyword/.test(signature)) return true;
      if (value.length > 80 && !isLikelyCategoryPicker(item)) return true;
      return false;
    };
    const clickablePickerNode = (node) =>
      node.closest?.("[role='combobox'],[aria-haspopup],[class*='cascader'],[class*='select'][class*='selector'],[class*='select'][class*='selection'],[class*='picker'],button") ||
      node;
    if (label) {
      const labelRect = label.getBoundingClientRect();
      const candidates = Array.from(document.querySelectorAll(baseSelector))
        .filter(visible)
        .map((node) => ({ node, rect: node.getBoundingClientRect(), label: text(node) }))
        .filter((item) => item.rect.left > labelRect.left - 8)
        .filter((item) => item.rect.left < labelRect.right + Math.max(760, innerWidth * 0.62))
        .filter((item) => item.rect.top > labelRect.top - 16)
        .filter((item) => item.rect.top < labelRect.bottom + Math.max(80, labelRect.height * 3.2))
        .filter((item) => item.rect.width >= 48 && item.rect.height >= 16)
        .filter((item) => !isBadCategoryCandidate(item))
        .sort((a, b) => {
          const aLikely = isLikelyCategoryPicker(a) ? 0 : 1;
          const bLikely = isLikelyCategoryPicker(b) ? 0 : 1;
          return aLikely - bLikely ||
            interactiveScore(a.node) - interactiveScore(b.node) ||
            Math.abs((a.rect.top + a.rect.height / 2) - (labelRect.top + labelRect.height / 2)) -
              Math.abs((b.rect.top + b.rect.height / 2) - (labelRect.top + labelRect.height / 2)) ||
            Math.abs(a.rect.left - labelRect.right) - Math.abs(b.rect.left - labelRect.right) ||
            a.rect.left - b.rect.left;
        });
      if (candidates[0]?.node) {
        const picker = clickablePickerNode(candidates[0].node);
        runtime.state.latestCategoryDebug = {
          ...(runtime.state.latestCategoryDebug || {}),
          picker: "near-label-adaptive",
          pickerText: candidates[0].label,
          pickerRect: `${Math.round(candidates[0].rect.left)},${Math.round(candidates[0].rect.top)},${Math.round(candidates[0].rect.width)}x${Math.round(candidates[0].rect.height)}`
        };
        return picker;
      }
    }
    const fallback = Array.from(document.querySelectorAll(baseSelector))
      .filter(visible)
      .map((node) => ({ node, rect: node.getBoundingClientRect(), label: text(node) }))
      .filter((item) => item.rect.width >= 48 && item.rect.height >= 16)
      .filter((item) => !isBadCategoryCandidate(item))
      .filter(isLikelyCategoryPicker)
      .sort((a, b) => interactiveScore(a.node) - interactiveScore(b.node) || a.rect.top - b.rect.top || a.rect.left - b.rect.left)[0];
    if (fallback?.node) {
      runtime.state.latestCategoryDebug = {
        ...(runtime.state.latestCategoryDebug || {}),
        picker: "fallback-adaptive",
        pickerText: fallback.label,
        pickerRect: `${Math.round(fallback.rect.left)},${Math.round(fallback.rect.top)},${Math.round(fallback.rect.width)}x${Math.round(fallback.rect.height)}`
      };
    }
    return fallback?.node ? clickablePickerNode(fallback.node) : null;
  }

  async function openCategoryMenu(picker) {
    for (let attempt = 1; attempt <= 3; attempt += 1) {
      fullClick(picker);
      const inner = picker.querySelector?.("input,[role='combobox'],[class*='arrow'],[class*='suffix']");
      if (inner && inner !== picker) fullClick(inner);
      const start = Date.now();
      while (Date.now() - start < 1800) {
        const columns = menuColumns();
        if (columns.length) {
          runtime.state.latestCategoryDebug = {
            ...(runtime.state.latestCategoryDebug || {}),
            openAttempt: attempt,
            menuColumnCount: columns.length
          };
          return true;
        }
        await sleep(120);
      }
    }
    runtime.state.latestCategoryDebug = {
      ...(runtime.state.latestCategoryDebug || {}),
      stage: "menu-not-opened",
      pickerText: text(picker)
    };
    return false;
  }

  function currentCategoryLabel() {
    return text(categoryPicker());
  }

  function rememberAppliedCategory(level1, level2, allClicked) {
    runtime.state.latestAppliedCategory = {
      level1,
      level2,
      allClicked: Boolean(allClicked),
      appliedAt: Date.now()
    };
  }

  function menuColumns() {
    return Array.from(document.querySelectorAll(".ecom-cascader-menu,[class*='cascader'][class*='menu'],[role='menu'],[role='listbox']"))
      .filter(visible)
      .sort((a, b) => a.getBoundingClientRect().left - b.getBoundingClientRect().left);
  }

  function oldStyleMenuItem(level, name, forceColumn = false) {
    const menus = menuColumns();
    const menu = menus[level];
    const findInMenu = (scope) => Array.from(scope.querySelectorAll(".ecom-cascader-menu-item,[class*='menu-item'],li,[role='option']"))
      .filter(visible)
      .find((item) => {
        const value = text(item).trim();
        return value === name || value.startsWith(`${name}\uFF08`) || value.startsWith(`${name}(`) || compact(value) === compact(name);
      }) || null;

    if (menu) {
      const scoped = findInMenu(menu);
      if (scoped || forceColumn) return scoped;
    }

    const escaped = String(name || "").replace(/["\\]/g, "\\$&");
    const byTitle = document.querySelector(`.ecom-cascader-menu-item[title="${escaped}"]`);
    if (byTitle && visible(byTitle)) return byTitle;

    const byRole = document.querySelector(`body [role="option"][data-level="${level + 1}"][title="${escaped}"]`);
    if (byRole && visible(byRole)) return byRole;

    if (!menu) return null;
    return findInMenu(menu);
  }

  function sameNameNextColumnItem(name, previousRect) {
    if (!previousRect) return null;
    return Array.from(document.querySelectorAll(".ecom-cascader-menu-item,[class*='menu-item'],li,[role='option']"))
      .filter(visible)
      .map((item) => ({ item, rect: item.getBoundingClientRect(), value: text(item).trim() }))
      .filter(({ rect }) => rect.left > previousRect.left + Math.max(30, previousRect.width * 0.5))
      .filter(({ value }) => value === name || value.startsWith(`${name}\uFF08`) || value.startsWith(`${name}(`) || compact(value) === compact(name))
      .sort((a, b) => a.rect.left - b.rect.left || a.rect.top - b.rect.top)[0]?.item || null;
  }

  function actionButton() {
    const labels = ["\u786e\u5b9a", "\u5b8c\u6210", "\u5e94\u7528", "\u7b5b\u9009", "\u67e5\u8be2"];
    const nodes = Array.from(document.querySelectorAll("button,a,[role='button'],span,div")).filter(visible);
    for (const label of labels) {
      const target = compact(label);
      const found = nodes.find((node) => compact(text(node)) === target);
      if (found) return found.closest?.("button,a,[role='button']") || found;
    }
    return null;
  }

  function pressEscape() {
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", code: "Escape", bubbles: true }));
    document.dispatchEvent(new KeyboardEvent("keyup", { key: "Escape", code: "Escape", bubbles: true }));
  }

  function isAlcoholSameNameCategory(level1, level2) {
    const alcohol = "\u9152\u7C7B";
    return compact(level1) === alcohol && compact(level2) === alcohol;
  }

  function categoryLabelMatches(level1, level2) {
    const label = compact(currentCategoryLabel());
    const latestApplied = runtime.state.latestAppliedCategory || null;
    const recentlyApplied =
      latestApplied &&
      Date.now() - Number(latestApplied.appliedAt || 0) < 20000 &&
      latestApplied.allClicked &&
      sameCompactText(latestApplied.level1, level1) &&
      sameCompactText(latestApplied.level2, level2);
    if (!label && recentlyApplied) {
      return true;
    }
    if (isAlcoholSameNameCategory(level1, level2)) {
      return label.includes(compact(`${level1}/${level2}/\u5168\u90E8`));
    }
    return label.includes(compact(level2)) || label.includes(compact(`${level1}/${level2}`));
  }

  async function waitForCategoryLabel(level1, level2, timeoutMs = 2600) {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      if (categoryLabelMatches(level1, level2)) {
        return true;
      }
      await sleep(160);
    }
    return categoryLabelMatches(level1, level2);
  }

  async function applyCategoryOnce(category, level1, level2, attempt) {
    const picker = categoryPicker();
    if (!picker) return { ok: false, message: "\u672a\u627e\u5230\u884c\u4e1a\u7c7b\u76ee\u9009\u62e9\u6846" };
    const opened = await openCategoryMenu(picker);
    if (!opened) return { ok: false, message: "\u7c7b\u76ee\u4e0b\u62c9\u6846\u672a\u6253\u5f00" };

    const path = [level1, level2];
    let previousRect = null;
    for (let level = 0; level < path.length; level += 1) {
      const name = path[level];
      let found = false;
      for (let retry = 0; retry < 4 && !found; retry += 1) {
        if (retry > 0) await sleep(500);
        const node = isAlcoholSameNameCategory(level1, level2) && level === 1
          ? sameNameNextColumnItem(name, previousRect)
          : oldStyleMenuItem(level, name);
        if (node) {
          previousRect = node.getBoundingClientRect();
          fullClick(node);
          found = true;
          break;
        }
      }
      if (!found) {
        runtime.state.latestCategoryDebug = { stage: `level${level + 1}-not-found`, attempt, target: `${level1}/${level2}`, columns: menuColumns().map(text) };
        return { ok: false, message: `\u672a\u627e\u5230\u7b2c ${level + 1} \u7ea7\u7c7b\u76ee\uff1a${name}` };
      }
      await sleep(3000);
    }

    let allClicked = false;
    for (let retry = 0; retry < 6 && !allClicked; retry += 1) {
      if (retry > 0) await sleep(1000);
      const menus = menuColumns();
      for (let index = menus.length - 1; index >= 0; index -= 1) {
        if (isAlcoholSameNameCategory(level1, level2) && index < 2) continue;
        const items = Array.from(menus[index].querySelectorAll(".ecom-cascader-menu-item,[class*='menu-item'],li,[role='option']"))
          .filter(visible);
        const allItem = items.find((item) => compact(text(item)) === compact("\u5168\u90e8"));
        if (allItem) {
          fullClick(allItem);
          await sleep(2000);
          allClicked = true;
          break;
        }
      }
    }
    if (!allClicked) {
      document.body.click();
      await sleep(1000);
    }
    rememberAppliedCategory(level1, level2, allClicked);

    await sleep(2000);
    const ok = await waitForCategoryLabel(level1, level2, 2400);
    return {
      ok,
      message: ok ? "\u7c7b\u76ee\u5207\u6362\u6210\u529f" : "\u7c7b\u76ee\u5c1a\u672a\u751f\u6548"
    };
  }

  async function switchToCategory(category) {
    const parts = String(category?.categoryName || category?.name || "").split("/");
    const level1 = category?.level1 || parts[0] || "";
    const level2 = category?.level2 || parts.slice(1).join("/") || parts[1] || "";
    if (!level1 || !level2) return { ok: false, message: "\u76ee\u6807\u7c7b\u76ee\u4e0d\u5b8c\u6574" };

    runtime.state.apiCandidates = [];
    runtime.state.latestApiRequest = null;
    runtime.state.latestApiCapturedAt = 0;

    await ensureTopButton(LABELS.ranking, 450);
    await ensureTopButton(LABELS.realtime, 450);
    await syncCategoryCatalog();

    const apiSwitch = await switchByCategoryApi(category, level1, level2).catch((error) => ({
      ok: false,
      message: error.message || String(error)
    }));
    return apiSwitch;
  }

  function rankingTableRect() {
    const rowSelectors = "tr[data-row-key],.ant-table-row,[class*='table'] tbody tr,table tbody tr";
    const rows = Array.from(document.querySelectorAll(rowSelectors)).filter(visible);
    if (!rows.length) return null;
    const rects = rows.map((row) => row.getBoundingClientRect());
    const left = Math.min(...rects.map((rect) => rect.left));
    const right = Math.max(...rects.map((rect) => rect.right));
    const top = Math.min(...rects.map((rect) => rect.top));
    const bottom = Math.max(...rects.map((rect) => rect.bottom));
    return { left, right, top, bottom, width: right - left, height: bottom - top };
  }

  function pagination() {
    const tableRect = rankingTableRect();
    const candidates = Array.from(document.querySelectorAll(".ecom-pagination,.ant-pagination,[class*='pagination']"))
      .filter(visible)
      .map((node) => ({ node, rect: node.getBoundingClientRect(), pages: pageItems(node).length }))
      .filter((item) => item.pages > 0);
    const nearTable = tableRect ? candidates
      .filter((item) => item.rect.top >= tableRect.bottom - 12)
      .filter((item) => item.rect.top <= tableRect.bottom + Math.max(260, innerHeight * 0.35))
      .filter((item) => item.rect.right >= tableRect.left && item.rect.left <= tableRect.right)
      .sort((a, b) => a.rect.top - b.rect.top)[0] : null;
    const picked = nearTable || candidates.sort((a, b) => b.rect.top - a.rect.top)[0] || null;
    if (picked?.node) {
      runtime.state.latestPaginationDebug = {
        picker: nearTable ? "near-table" : "fallback-bottom",
        rect: `${Math.round(picked.rect.left)},${Math.round(picked.rect.top)},${Math.round(picked.rect.width)}x${Math.round(picked.rect.height)}`,
        pages: pageItems(picked.node).map((item) => item.num)
      };
    }
    return picked?.node || null;
  }

  function pageItems(container = pagination()) {
    if (!container) return [];
    const map = new Map();
    Array.from(container.querySelectorAll("a,button,span,div,li"))
      .filter(visible)
      .forEach((node) => {
        const value = compact(text(node));
        if (!/^\d+$/.test(value)) return;
        const num = Number(value);
        if (!num || num > 500) return;
        const clickNode = node.closest?.("a,button,li") || node;
        if (!map.has(num)) map.set(num, clickNode);
      });
    return Array.from(map.entries()).map(([num, el]) => ({ num, el })).sort((a, b) => a.num - b.num);
  }

  function isActivePageElement(node, container) {
    let current = node;
    while (current && current !== container) {
      const className = String(current.className || "");
      if (
        current.getAttribute?.("aria-current") ||
        /(^|[-_\s])(active|current|selected)([-_\s]|$)/i.test(className)
      ) {
        return true;
      }
      current = current.parentElement;
    }
    return false;
  }

  function currentPage() {
    const pager = pagination();
    if (!pager) return 1;
    const activeItem = pageItems(pager).find((item) => isActivePageElement(item.el, pager));
    if (activeItem?.num) return activeItem.num;
    const active = Array.from(pager.querySelectorAll("[aria-current],[class*='active'],[class*='current'],[class*='selected']"))
      .filter(visible)
      .find((node) => /^\d+$/.test(compact(text(node))));
    return Number(compact(text(active))) || 1;
  }

  function pageButton(page) {
    return pageItems().find((item) => item.num === page)?.el || null;
  }

  function nextButton() {
    const pager = pagination();
    if (!pager) return null;
    const cur = currentPage();
    const directNext = pageItems(pager).find((item) => item.num === cur + 1)?.el;
    if (directNext) return directNext;
    const found = pager.querySelector("li[class*='next']:not([class*='disabled']),button[class*='next']:not([disabled])") ||
      Array.from(pager.querySelectorAll("a,button,li"))
        .filter(visible)
        .find((node) => /^(>|›|\u4e0b\u4e00\u9875)$/.test(compact(text(node))));
    return found?.querySelector?.("a,button") || found || null;
  }

  function apiCandidateCount(after = 0) {
    return (runtime.state.apiCandidates || [])
      .filter((item) => item.responseText && Number(item.capturedAt || 0) >= after)
      .length;
  }

  async function waitForPageReady(page, after, maxMs = 1400) {
    const start = Date.now();
    while (Date.now() - start < maxMs) {
      if (currentPage() === page && apiCandidateCount(after) > 0) {
        return true;
      }
      await sleep(140);
    }
    return currentPage() === page;
  }

  async function goToPage(page) {
    if (currentPage() === page) return true;
    let target = pageButton(page) || nextButton();
    if (!target) return false;
    const beforeClick = Date.now();
    fullClick(target);
    const start = Date.now();
    while (Date.now() - start < 6000) {
      if (currentPage() === page) {
        await waitForPageReady(page, beforeClick, 1400);
        return true;
      }
      await sleep(300);
    }
    if (currentPage() !== page) {
      target = nextButton();
      if (target) {
        const beforeFallback = Date.now();
        fullClick(target);
        await waitForPageReady(page, beforeFallback, 2200);
      }
    }
    return currentPage() === page;
  }

  async function triggerCurrentPageRefresh(page) {
    const button = pageButton(page);
    if (button) {
      fullClick(button);
      await sleep(650);
      return true;
    }
    const realtime = findTopButton(LABELS.realtime);
    if (realtime) {
      click(realtime);
      await sleep(650);
      return true;
    }
    return false;
  }

  function refreshActionButtons() {
    return Array.from(document.querySelectorAll("button,a,[role='button']"))
      .filter(visible)
      .filter((node) => /^(刷新|查询|搜索|确定|重置)$/.test(compact(text(node))))
      .slice(0, 4);
  }

  async function triggerAggressiveRefresh(page) {
    const before = Date.now();
    await triggerCurrentPageRefresh(page);
    const ranking = findTopButton(LABELS.ranking);
    const realtime = findTopButton(LABELS.realtime);
    if (ranking) {
      click(ranking);
      await sleep(350);
    }
    if (realtime) {
      click(realtime);
      await sleep(350);
    }
    for (const button of refreshActionButtons()) {
      click(button);
      await sleep(450);
      if (apiCandidateCount(before) > 0) break;
    }
    return before;
  }

  function parseJson(value) {
    try {
      return value ? JSON.parse(value) : null;
    } catch {
      return null;
    }
  }

  function objectValuesDeep(input, visitor, depth = 0) {
    if (depth > 7 || input == null) return;
    visitor(input);
    if (Array.isArray(input)) {
      input.forEach((item) => objectValuesDeep(item, visitor, depth + 1));
      return;
    }
    if (typeof input === "object") {
      Object.values(input).forEach((item) => objectValuesDeep(item, visitor, depth + 1));
    }
  }

  function getByKeysDeep(input, keys) {
    let found = "";
    const wanted = keys.map((key) => key.toLowerCase());
    objectValuesDeep(input, (value) => {
      if (found || !value || typeof value !== "object" || Array.isArray(value)) return;
      for (const [key, item] of Object.entries(value)) {
        if (wanted.includes(String(key).toLowerCase()) && item != null && typeof item !== "object") {
          found = String(item).trim();
          return;
        }
      }
    });
    return found;
  }

  function getByKeyFragmentsDeep(input, fragments) {
    let found = "";
    const wanted = fragments.map((key) => key.toLowerCase());
    objectValuesDeep(input, (value) => {
      if (found || !value || typeof value !== "object" || Array.isArray(value)) return;
      for (const [key, item] of Object.entries(value)) {
        const lower = String(key).toLowerCase();
        if (wanted.some((fragment) => lower.includes(fragment)) && item != null && typeof item !== "object") {
          found = String(item).trim();
          return;
        }
      }
    });
    return found;
  }

  function numberByKeysDeep(input, keys) {
    const raw = getByKeysDeep(input, keys);
    const value = Number(String(raw).replace(/[^\d.-]/g, ""));
    return Number.isFinite(value) ? value : 0;
  }

  function mediaUrl(input, fragments) {
    let found = "";
    objectValuesDeep(input, (value) => {
      if (found || !value || typeof value !== "object" || Array.isArray(value)) return;
      for (const [key, item] of Object.entries(value)) {
        const lower = String(key).toLowerCase();
        if (!fragments.some((fragment) => lower.includes(fragment))) continue;
        const candidates = Array.isArray(item) ? item : [item];
        for (const candidate of candidates) {
          if (typeof candidate === "string" && /^(https?:)?\/\//i.test(candidate)) {
            found = candidate.startsWith("//") ? `https:${candidate}` : candidate;
            return;
          }
        }
      }
    });
    return found;
  }

  function looksLikeVideoMediaUrl(value) {
    const url = String(value || "").trim();
    if (!url || !/^(https?:)?\/\//i.test(url)) return false;
    if (/avatar|logo|shop|store/i.test(url)) return false;
    return /video|aweme|douyin|tos|byteimg|douyinpic|poster|cover|thumb/i.test(url);
  }

  function looksLikeImageUrl(value) {
    const url = String(value || "").trim();
    return /\.(?:png|jpe?g|webp|gif)(?:\?|$)|tplv-|image\.image|douyinpic\.com\/img/i.test(url);
  }

  function normalizeRank(rawRank, page, index) {
    const fallback = (page - 1) * 10 + index + 1;
    const parsed = Number(rawRank || 0);
    if (!Number.isFinite(parsed) || parsed < 1 || parsed > 100) {
      return fallback;
    }
    if (page > 1 && parsed <= 10) {
      return fallback;
    }
    return parsed;
  }

  function douyinVideoUrl(videoId) {
    const id = String(videoId || "").trim();
    return id ? `https://www.douyin.com/video/${encodeURIComponent(id)}` : "";
  }

  function videoCoverUrl(input) {
    const cover = mediaUrl(input, ["videocover", "video_cover", "aweme_cover", "cover_url", "poster", "thumb"]);
    return looksLikeVideoMediaUrl(cover) ? cover : "";
  }

  function hasVideoSignal(entry, url, cover, title, time) {
    return Boolean(
      url ||
      cover ||
      getByKeysDeep(entry, ["videoId", "video_id", "awemeId", "aweme_id"]) ||
      getByKeysDeep(entry, ["videoTitle", "video_title", "awemeTitle", "aweme_title"]) ||
      (title && time)
    );
  }

  function normalizeRange(value) {
    if (!value) return "";
    if (typeof value === "object") {
      const direct = value.value || value.range || value.showValue || value.displayValue || value.text || value.label || "";
      if (direct) return normalizeRange(direct);
      const min = value.min ?? value.lower ?? value.start ?? value.from;
      const max = value.max ?? value.upper ?? value.end ?? value.to;
      if (min != null || max != null) return `${min ?? ""}-${max ?? ""}`;
      return "";
    }
    const compact = String(value).replace(/\s+/g, "").trim();
    if (!compact || /^(true|false)$/i.test(compact) || /^(https?:)?\/\//i.test(compact)) return "";
    return compact
      .replace(/^(?:\u77ed\u89c6\u9891)?(?:\u7528\u6237)?(?:\u652f\u4ed8\u91d1\u989d|\u70b9\u51fb\u6b21\u6570|\u6210\u4ea4\u4ef6\u6570)/, "")
      .replace(/^(?:\u652f\u4ed8|\u70b9\u51fb|\u6210\u4ea4)(?:\u533a\u95f4)?/, "");
  }

  function rangeByFragments(input, fragments) {
    let found = "";
    const wanted = fragments.map((item) => item.toLowerCase());
    objectValuesDeep(input, (value) => {
      if (found || !value || typeof value !== "object" || Array.isArray(value)) return;
      for (const [key, item] of Object.entries(value)) {
        const lower = String(key).toLowerCase();
        if (wanted.some((fragment) => lower.includes(fragment))) {
          const normalized = normalizeRange(item);
          if (normalized && !/^https?:/i.test(normalized)) {
            found = normalized;
            return;
          }
        }
      }
    });
    return found;
  }

  function isProductRankApiUrl(url) {
    return /\/shop\/product\/product_rank\//i.test(String(url || ""));
  }

  function findRankingArrays(payload, sourceUrl = "") {
    const arrays = [];
    const isProductRankApi = isProductRankApiUrl(sourceUrl);
    objectValuesDeep(payload, (value) => {
      if (!Array.isArray(value) || value.length < 3) return;
      const objects = value.filter((item) => item && typeof item === "object" && !Array.isArray(item));
      if (objects.length < 3) return;
      const sample = objects.slice(0, 5);
      const score = sample.reduce((total, item) => {
        const productName = getByKeysDeep(item, [
          "productName",
          "product_name",
          "productTitle",
          "product_title",
          "goodsName",
          "goods_name",
          "itemName",
          "item_name",
          "itemTitle",
          "item_title",
          "title",
          "name"
        ]);
        const productId = getByKeysDeep(item, ["productId", "product_id", "goodsId", "goods_id", "itemId", "item_id", "id"]);
        const rank = numberByKeysDeep(item, ["rank", "ranking", "rankNo", "rank_no", "seq", "index"]);
        const image = mediaUrl(item, ["image", "img", "cover", "pic"]);
        const metric = rangeByFragments(item, ["pay", "payment", "gmv", "click", "order", "deal", "amount", "\u652f\u4ed8", "\u70b9\u51fb", "\u6210\u4ea4"]);
        const videoSignal = getByKeysDeep(item, ["videoId", "video_id", "awemeId", "aweme_id", "videoTitle", "video_title"]);
        return total +
          (productName ? 4 : 0) +
          (productId ? 3 : 0) +
          (rank ? 3 : isProductRankApi ? 2 : 0) +
          (image ? 1 : 0) +
          (metric ? 2 : 0) +
          (videoSignal ? 1 : 0);
      }, 0);
      if (score >= (isProductRankApi ? 8 : 12)) arrays.push({ rows: objects, score });
    });
    return arrays.sort((a, b) => b.score - a.score || b.rows.length - a.rows.length);
  }

  function videoListFromItem(item) {
    const videos = [];
    objectValuesDeep(item, (value) => {
      if (!Array.isArray(value) || videos.length >= 8) return;
      const candidates = value.filter((entry) => entry && typeof entry === "object" && !Array.isArray(entry));
      candidates.forEach((entry) => {
        const videoId = getByKeysDeep(entry, ["videoId", "video_id", "awemeId", "aweme_id", "id"]);
        const rawUrl = mediaUrl(entry, ["play", "video", "share", "url"]);
        const cover = videoCoverUrl(entry) || (looksLikeImageUrl(rawUrl) ? rawUrl : "");
        const url = looksLikeImageUrl(rawUrl) ? douyinVideoUrl(videoId) : rawUrl;
        const title = getByKeysDeep(entry, ["title", "desc", "name", "videoTitle", "video_title"]);
        const time = getByKeyFragmentsDeep(entry, ["publish", "create_time", "timestamp", "date"]);
        if (hasVideoSignal(entry, url, cover, title, time)) {
          videos.push({
            videoId,
            videoTitle: title,
            videoUrl: url,
            videoCover: cover,
            videoPublishedAt: time,
            paymentRange: rangeByFragments(entry, ["pay", "payment", "gmv"]),
            clickRange: rangeByFragments(entry, ["click"]),
            orderRange: rangeByFragments(entry, ["order", "deal"]),
            videoCountRange: "",
            creatorName: getByKeysDeep(entry, ["creatorName", "authorName", "nickName", "nickname"])
          });
        }
      });
    });
    return videos.slice(0, 8);
  }

  function normalizeApiRow(item, meta, page, index) {
    const videos = videoListFromItem(item);
    const fallbackVideoId = getByKeysDeep(item, ["videoId", "video_id", "awemeId", "aweme_id"]);
    const fallbackVideoUrl = mediaUrl(item, ["play", "video", "share"]);
    const fallbackVideoCover = videoCoverUrl(item) || (looksLikeImageUrl(fallbackVideoUrl) ? fallbackVideoUrl : "");
    const productName =
      getByKeysDeep(item, [
        "productName",
        "product_name",
        "productTitle",
        "product_title",
        "goodsName",
        "goods_name",
        "itemName",
        "item_name",
        "itemTitle",
        "item_title",
        "title",
        "name"
      ]) ||
      getByKeyFragmentsDeep(item, ["product_name", "product_title", "goods_name", "item_name", "item_title"]);
    const rank = normalizeRank(numberByKeysDeep(item, ["rank", "ranking", "rankNo", "rank_no", "rankValue", "rank_value"]), page, index);
    const productImage = mediaUrl(item, ["productimage", "product_image", "goodsimage", "goods_image", "image", "img", "pic"]);

    return {
      categoryId: meta.categoryId || "",
      categoryName: meta.categoryName || "",
      rankingType: runtime.config.rankingType || LABELS.ranking,
      page,
      rank,
      productId: getByKeysDeep(item, ["productId", "product_id", "goodsId", "goods_id", "itemId", "item_id", "id"]),
      productName,
      productUrl: getByKeyFragmentsDeep(item, ["producturl", "detailurl", "schema", "href", "link"]),
      productImage: productImage,
      shopName: getByKeysDeep(item, ["shopName", "shop_name", "storeName", "store_name"]),
      shopUrl: getByKeyFragmentsDeep(item, ["shopurl", "storeurl"]),
      videoId: videos[0]?.videoId || fallbackVideoId,
      videoTitle: videos[0]?.videoTitle || getByKeysDeep(item, ["videoTitle", "video_title", "awemeTitle", "aweme_title"]),
      videoUrl: videos[0]?.videoUrl || (looksLikeImageUrl(fallbackVideoUrl) ? douyinVideoUrl(fallbackVideoId) : fallbackVideoUrl),
      videoCover: videos[0]?.videoCover || fallbackVideoCover,
      videoPublishedAt: videos[0]?.videoPublishedAt || getByKeyFragmentsDeep(item, ["publish", "create_time", "timestamp", "date"]),
      videos,
      detectedVideoCount: videos.length || numberByKeysDeep(item, ["videoCount", "video_count", "awemeCount", "aweme_count"]),
      paymentRange: rangeByFragments(item, ["pay", "payment", "gmv", "amount", "\u652f\u4ed8", "\u91d1\u989d"]),
      clickRange: rangeByFragments(item, ["click", "pv", "\u70b9\u51fb"]),
      orderRange: rangeByFragments(item, ["order", "deal", "sale", "\u6210\u4ea4", "\u4ef6\u6570"]),
      videoCountRange: rangeByFragments(item, ["video_count", "aweme_count"]) || String(videos.length || ""),
      isCompassFirstListed: /first|new/i.test(JSON.stringify(item).slice(0, 500)),
      creatorName: getByKeysDeep(item, ["creatorName", "authorName", "nickName", "nickname"])
    };
  }

  function rowsFromCandidate(candidate, meta, page) {
    const payload = parseJson(candidate?.responseText || "");
    const best = findRankingArrays(payload, candidate?.url || "")[0];
    if (!best) return [];
    return best.rows
      .slice(0, 10)
      .map((item, index) => normalizeApiRow(item, meta, page, index))
      .filter((row) => row.productName || row.productId || row.videoTitle);
  }

  function metricRowCount(rows) {
    return (rows || []).filter((row) => row.paymentRange || row.clickRange || row.orderRange).length;
  }

  function hasEnoughMetrics(rows) {
    if (!rows?.length) return false;
    return metricRowCount(rows) >= Math.min(3, rows.length);
  }

  function visibleTableRows() {
    const rowSelectors = "tr[data-row-key],.ant-table-row,[class*='table'] tbody tr,table tbody tr";
    return Array.from(document.querySelectorAll(rowSelectors))
      .filter(visible)
      .filter((row) => {
        const rowText = compact(text(row));
        return rowText && !/^商品/.test(rowText) && !/支付金额点击次数成交件数/.test(rowText);
      })
      .slice(0, 10);
  }

  function cjkCount(value) {
    return Array.from(String(value || "")).filter((ch) => {
      const code = ch.charCodeAt(0);
      return code >= 0x4e00 && code <= 0x9fff;
    }).length;
  }

  function isMetricRange(value) {
    const cell = String(value || "").replace(/\s+/g, "");
    if (!cell || cell.length > 24) return false;
    if (!/\d/.test(cell) || !/[-~]/.test(cell)) return false;
    if (cjkCount(cell) >= 5) return false;
    if (/^20\d{2}/.test(cell)) return false;
    const normalized = cell.replace(/\uFFE5|\u00A5/g, "").toLowerCase();
    return /^[0-9.,]+(?:\u5143|\u4e07|\u5343|w|k)?[-~][0-9.,]+(?:\u5143|\u4e07|\u5343|w|k)?$/.test(normalized);
  }

  function visibleTableFallbackRows(meta, page) {
    return visibleTableRows()
      .map((row, index) => {
        const cells = Array.from(row.querySelectorAll("td,[role='cell']"))
          .map((cell) => text(cell))
          .filter(Boolean);
        const rowText = text(row);
        const firstRank = Number((cells.find((cell) => /^\s*\d+\s*$/.test(cell)) || "").replace(/[^\d]/g, ""));
        const rank = normalizeRank(firstRank, page, index);
        const ranges = cells.map((cell) => cell.replace(/\s+/g, "")).filter(isMetricRange);
        const image = row.querySelector("img[src]")?.src || "";
        const productName = cells.find((cell) => {
          const compactCell = compact(cell);
          if (!compactCell || /^\d+$/.test(compactCell) || isMetricRange(compactCell)) return false;
          if (/首次上榜|支付|点击|成交|短视频|直播|达人|佣金/.test(compactCell)) return false;
          return cjkCount(compactCell) >= 2;
        }) || rowText.slice(0, 80);

        return {
          categoryId: meta.categoryId || "",
          categoryName: meta.categoryName || "",
          rankingType: runtime.config.rankingType || LABELS.ranking,
          page,
          rank,
          productId: "",
          productName,
          productUrl: "",
          productImage: image,
          shopName: "",
          shopUrl: "",
          videoId: "",
          videoTitle: "",
          videoUrl: "",
          videoCover: "",
          videoPublishedAt: "",
          videos: [],
          detectedVideoCount: 0,
          paymentRange: ranges[0] || "",
          clickRange: ranges[1] || "",
          orderRange: ranges[2] || "",
          videoCountRange: "",
          isCompassFirstListed: rowText.includes("\u9996\u6b21\u4e0a\u699c"),
          creatorName: ""
        };
      })
      .filter((row) => row.productName);
  }

  function visibleTablePatchRows(page) {
    const cjkCount = (value) =>
      Array.from(String(value || "")).filter((ch) => {
        const code = ch.charCodeAt(0);
        return code >= 0x4e00 && code <= 0x9fff;
      }).length;
    const isMetricRange = (value) => {
      const cell = String(value || "").replace(/\s+/g, "");
      if (!cell || cell.length > 24) return false;
      if (!/\d/.test(cell) || !/[-~]/.test(cell)) return false;
      if (cjkCount(cell) >= 5) return false;
      if (/^20\d{2}/.test(cell)) return false;
      const normalized = cell.replace(/\uFFE5|\u00A5/g, "").toLowerCase();
      return /^[0-9.,]+(?:\u5143|\u4e07|\u5343|w|k)?[-~][0-9.,]+(?:\u5143|\u4e07|\u5343|w|k)?$/.test(normalized);
    };
    return visibleTableRows()
      .map((row, index) => {
        const rowText = compact(text(row));
        const cells = Array.from(row.querySelectorAll("td,[role='cell']")).map((cell) => text(cell));
        const ranges = cells
          .slice(Math.max(0, cells.length - 6))
          .map((cell) => cell.replace(/\s+/g, ""))
          .filter(isMetricRange);
        return {
          rank: (page - 1) * 10 + index + 1,
          paymentRange: ranges[0] || "",
          clickRange: ranges[1] || "",
          orderRange: ranges[2] || "",
          isCompassFirstListed: rowText.includes("\u9996\u6b21\u4e0a\u699c")
        };
      });
  }

  function mergeVisibleMetrics(rows, page) {
    const byRank = new Map(visibleTablePatchRows(page).map((item) => [Number(item.rank), item]));
    return rows.map((row) => {
      const fill = byRank.get(Number(row.rank));
      if (!fill) return row;
      return {
        ...row,
        paymentRange: row.paymentRange || fill.paymentRange,
        clickRange: row.clickRange || fill.clickRange,
        orderRange: row.orderRange || fill.orderRange,
        isCompassFirstListed: Boolean(row.isCompassFirstListed || fill.isCompassFirstListed)
      };
    });
  }

  function bestRecentRows(meta, page, after = 0) {
    const candidates = (runtime.state.apiCandidates || [])
      .filter((item) => item.responseText && Number(item.capturedAt || 0) >= after)
      .sort((a, b) => Number(b.capturedAt || 0) - Number(a.capturedAt || 0));
    for (const candidate of candidates) {
      const rows = rowsFromCandidate(candidate, meta, page);
      if (rows.length) return { rows, candidate };
    }
    return { rows: [], candidate: null };
  }

  function recentApiSummary(after = 0) {
    const candidates = (runtime.state.apiCandidates || [])
      .filter((item) => item.responseText && Number(item.capturedAt || 0) >= after)
      .sort((a, b) => Number(b.capturedAt || 0) - Number(a.capturedAt || 0));
    return {
      count: candidates.length,
      latestUrl: candidates[0]?.url || "",
      latestLength: candidates[0]?.responseText?.length || 0
    };
  }

  function latestRankTemplate() {
    return runtime.state.latestRankApiTemplate ||
      (runtime.state.apiCandidates || [])
        .filter((item) => item?.url && isProductRankApiUrl(item.url))
        .sort((a, b) => Number(b.capturedAt || 0) - Number(a.capturedAt || 0))[0] ||
      null;
  }

  function urlFromTemplate(template) {
    try {
      return new URL(template?.url || "", location.origin);
    } catch {
      return null;
    }
  }

  function normalizedParamName(value) {
    return String(value || "").replace(/[^a-z0-9]/gi, "").toLowerCase();
  }

  function categoryParamValue(name, meta) {
    const key = normalizedParamName(name);
    if (!key) return "";
    if (/^(industry|industryid|industryids|firstcate|firstcateid|firstcateids|firstcategory|firstcategoryid|firstcategoryids|level1cate|level1cateid|level1category|level1categoryid)$/.test(key)) {
      return String(meta.industryId || "");
    }
    if (/^(category|categoryid|categoryids|cate|cateid|cateids|secondcate|secondcateid|secondcateids|secondcategory|secondcategoryid|secondcategoryids|leafcate|leafcateid|leafcategory|leafcategoryid)$/.test(key)) {
      return String(meta.categoryId || "");
    }
    return "";
  }

  function replacementWithSameShape(current, replacement) {
    if (Array.isArray(current)) return [replacement];
    if (typeof current === "number") return Number(replacement) || replacement;
    if (typeof current !== "string") return replacement;
    const trimmed = current.trim();
    if (trimmed.startsWith("[") && trimmed.endsWith("]")) {
      return JSON.stringify([replacement]);
    }
    return replacement;
  }

  function rewriteCategoryJson(value, meta, parentKey = "") {
    const direct = categoryParamValue(parentKey, meta);
    if (direct) {
      return { changed: true, value: replacementWithSameShape(value, direct) };
    }
    if (Array.isArray(value)) {
      let changed = false;
      const next = value.map((item) => {
        const rewritten = rewriteCategoryJson(item, meta, "");
        changed ||= rewritten.changed;
        return rewritten.value;
      });
      return { changed, value: next };
    }
    if (!value || typeof value !== "object") return { changed: false, value };

    const fieldName = value.field || value.fieldName || value.key || value.name || "";
    const fieldReplacement = categoryParamValue(fieldName, meta);
    let changed = false;
    const next = { ...value };
    for (const [key, item] of Object.entries(value)) {
      const isFilterValue = fieldReplacement && /^(value|values|selected|selection|ids?)$/i.test(key);
      if (isFilterValue) {
        next[key] = replacementWithSameShape(item, fieldReplacement);
        changed = true;
        continue;
      }
      const rewritten = rewriteCategoryJson(item, meta, key);
      if (rewritten.changed) {
        next[key] = rewritten.value;
        changed = true;
      }
    }
    return { changed, value: next };
  }

  function rewriteCategoryUrlParams(params, meta) {
    let categoryChanged = false;
    let industryChanged = false;
    for (const [key, rawValue] of Array.from(params.entries())) {
      const direct = categoryParamValue(key, meta);
      if (direct) {
        params.set(key, replacementWithSameShape(rawValue, direct));
        if (String(direct) === String(meta.categoryId || "")) categoryChanged = true;
        if (String(direct) === String(meta.industryId || "")) industryChanged = true;
        continue;
      }
      try {
        const parsed = JSON.parse(rawValue);
        const rewritten = rewriteCategoryJson(parsed, meta);
        if (rewritten.changed) {
          params.set(key, JSON.stringify(rewritten.value));
          categoryChanged = categoryChanged || JSON.stringify(rewritten.value).includes(String(meta.categoryId || ""));
          industryChanged = industryChanged || Boolean(meta.industryId && JSON.stringify(rewritten.value).includes(String(meta.industryId)));
        }
      } catch {
        // Non-JSON query values are handled by their parameter names above.
      }
    }
    if (!categoryChanged && meta.categoryId) params.set("category_id", String(meta.categoryId));
    if (!industryChanged && meta.industryId) params.set("industry_id", String(meta.industryId));
  }

  function categoryApiUrl(template, meta, page) {
    const url = urlFromTemplate(template);
    if (!url || !meta.categoryId) return "";
    const params = url.searchParams;
    rewriteCategoryUrlParams(params, meta);
    ["page_no", "pageNo", "page", "current"].forEach((name) => {
      if (params.has(name)) params.set(name, String(page));
    });
    ["page_size", "pageSize", "limit"].forEach((name) => {
      if (params.has(name)) params.set(name, "10");
    });
    if (!["page_no", "pageNo", "page", "current"].some((name) => params.has(name))) params.set("page_no", String(page));
    if (!["page_size", "pageSize", "limit"].some((name) => params.has(name))) params.set("page_size", "10");
    return url.toString();
  }

  async function fetchCategoryPage(meta, page) {
    const template = latestRankTemplate();
    const url = categoryApiUrl(template, meta, page);
    if (!url) return null;
    const response = await fetch(url, {
      method: "GET",
      credentials: "include",
      headers: { accept: "application/json, text/plain, */*" }
    });
    const candidate = {
      url,
      method: "GET",
      headers: {},
      bodyText: "",
      responseText: await response.text(),
      source: "category-api",
      capturedAt: Date.now(),
      status: response.status
    };
    runtime.state.latestApiRequest = candidate;
    runtime.state.latestApiCapturedAt = candidate.capturedAt;
    runtime.state.apiCandidates = [candidate, ...(runtime.state.apiCandidates || [])].slice(0, 50);
    return candidate;
  }

  async function captureByCategoryApi(meta, pageLimit) {
    if (!latestRankTemplate() || !meta.categoryId) return null;
    const records = [];
    const debug = [];
    for (let page = 1; page <= pageLimit; page += 1) {
      let candidate = null;
      let rows = [];
      try {
        candidate = await fetchCategoryPage(meta, page);
        rows = rowsFromCandidate(candidate, meta, page);
      } catch (error) {
        debug.push({ page, ok: false, count: 0, api: "", directCategoryApi: true, error: error.message || String(error) });
        continue;
      }
      if (rows.length && !hasEnoughMetrics(rows)) {
        debug.push({
          page,
          ok: false,
          count: rows.length,
          currentPage: page,
          api: candidate?.url || "",
          apiCandidateCount: 1,
          latestApi: candidate?.url || "",
          latestApiLength: candidate?.responseText?.length || 0,
          directCategoryApi: true,
          status: candidate?.status || 0,
          missingMetrics: true
        });
        runtime.state.latestCaptureDiagnostics = {
          captureMode: "api-category-v1-missing-metrics",
          recordCount: 0,
          successfulPages: 0,
          pageLimit,
          latestPage: page,
          latestApi: candidate?.url || "",
          debug
        };
        return null;
      }
      records.push(...rows);
      debug.push({
        page,
        ok: Boolean(rows.length),
        count: rows.length,
        currentPage: page,
        api: candidate?.url || "",
        apiCandidateCount: 1,
        latestApi: candidate?.url || "",
        latestApiLength: candidate?.responseText?.length || 0,
        directCategoryApi: true,
        status: candidate?.status || 0
      });
      runtime.state.latestCaptureDiagnostics = {
        captureMode: "api-category-v1",
        recordCount: records.length,
        successfulPages: debug.filter((item) => item.count > 0).length,
        pageLimit,
        latestPage: page,
        latestApi: candidate?.url || "",
        debug
      };
      await sleep(180);
    }
    return {
      records,
      debug,
      successfulPages: debug.filter((item) => item.count > 0).length,
      detectedCategory: meta
    };
  }

  async function switchByCategoryApi(category, level1, level2) {
    const meta = {
      categoryId: category.categoryId || category.id || "",
      categoryName: category.categoryName || category.name || `${level1}/${level2}`,
      level1,
      level2,
      industryId: category.industryId || ""
    };
    const candidate = await fetchCategoryPage(meta, 1);
    const rows = rowsFromCandidate(candidate, meta, 1);
    if (!rows.length) {
      return { ok: false, message: "\u63a5\u53e3\u5207\u6362\u7c7b\u76ee\u672a\u8fd4\u56de\u699c\u5355\u6570\u636e" };
    }
    if (!hasEnoughMetrics(rows)) {
      return { ok: false, message: "\u7c7b\u76ee\u63a5\u53e3\u7f3a\u5c11\u652f\u4ed8/\u70b9\u51fb/\u6210\u4ea4\u6307\u6807" };
    }
    runtime.state.activeCategoryApiMeta = { ...meta, appliedAt: Date.now() };
    return {
      ok: true,
      detected: { categoryId: meta.categoryId, categoryName: meta.categoryName },
      message: "\u63a5\u53e3\u5207\u6362\u7c7b\u76ee\u6210\u529f"
    };
  }

  async function waitForApiRows(meta, page, after, timeoutMs = 10000) {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      const result = bestRecentRows(meta, page, after);
      if (result.rows.length) return result;
      await sleep(160);
    }
    return bestRecentRows(meta, page, after);
  }

  async function capture(meta = {}) {
    const pageLimit = Number(meta.pageLimit || runtime.state.pageLimit || runtime.config.pageLimit || 10);
    const resolvedMeta = {
      categoryId: meta.categoryId || "",
      categoryName: meta.categoryName || currentCategoryLabel() || "",
      industryId: meta.industryId || ""
    };
    const activeApiMeta = runtime.state.activeCategoryApiMeta || null;
    if (
      activeApiMeta &&
      activeApiMeta.categoryId === resolvedMeta.categoryId &&
      Date.now() - Number(activeApiMeta.appliedAt || 0) < 5 * 60 * 1000
    ) {
      const apiResult = await captureByCategoryApi({ ...resolvedMeta, industryId: activeApiMeta.industryId || resolvedMeta.industryId }, pageLimit);
      if (apiResult?.records?.length) {
        return apiResult;
      }
    }
    const records = [];
    const debug = [];

    const keepAfter = Date.now() - 30000;
    runtime.state.apiCandidates = (runtime.state.apiCandidates || [])
      .filter((item) => Number(item.capturedAt || 0) >= keepAfter);

    await ensureTopButton(LABELS.ranking, 300);
    await ensureTopButton(LABELS.realtime, 300);

    for (let page = 1; page <= pageLimit; page += 1) {
      const before = Date.now();
      if (page === 1) {
        await goToPage(1);
        await triggerCurrentPageRefresh(1);
      }
      const pageOk = await goToPage(page);
      let result = await waitForApiRows(resolvedMeta, page, before);
      if (page === 1 && !result.rows.length) {
        result = bestRecentRows(resolvedMeta, page, keepAfter);
      }
      let retried = false;
      if (page === 1 && !result.rows.length) {
        retried = true;
        const retryAfter = await triggerAggressiveRefresh(1);
        result = await waitForApiRows(resolvedMeta, page, retryAfter, 12000);
        if (!result.rows.length) {
          result = bestRecentRows(resolvedMeta, page, keepAfter);
        }
      }
      result = { ...result, rows: mergeVisibleMetrics(result.rows, page) };
      const apiSummary = recentApiSummary(before);
      records.push(...result.rows);
      debug.push({
        page,
        ok: pageOk,
        count: result.rows.length,
        currentPage: currentPage(),
        api: result.candidate?.url || "",
        apiCandidateCount: apiSummary.count,
        latestApi: apiSummary.latestUrl,
        latestApiLength: apiSummary.latestLength,
        retried
      });
      runtime.state.latestCaptureDiagnostics = {
        captureMode: "api-v4",
        recordCount: records.length,
        successfulPages: debug.filter((item) => item.count > 0).length,
        pageLimit,
        latestPage: page,
        latestApi: result.candidate?.url || "",
        debug
      };
      if (!result.rows.length) {
        await sleep(300);
      }
    }

    return {
      records,
      debug,
      successfulPages: debug.filter((item) => item.count > 0).length,
      detectedCategory: resolvedMeta
    };
  }

  runtime.silentCapture = {
    getStandardCategories: getCategories,
    syncCategoryCatalog,
    getCurrentCategoryDisplayName: currentCategoryLabel,
    detectCurrentCategory() {
      const label = currentCategoryLabel();
      const found = getCategories().find((item) => compact(label).includes(compact(item.level2 || item.name)));
      return found ? { categoryId: found.id, categoryName: found.name } : { categoryId: "", categoryName: label };
    },
    switchToCategory,
    testSwitchToCategory: switchToCategory,
    collectSilently: capture
  };
})();
