import { nanoid } from "nanoid";
import {
  appendCaptureBatch,
  readDiagnostics,
  readBatchesByCategory,
  readCaptureBatches,
  readCategories,
  readCategoryStats,
  readLatestCaptureHours,
  readOverviewStats,
  readRecentRecordsByCategory,
  readRecordsByBatchIds,
  readRecordsByCategoryAndBatchIds,
  readRecordsByCategoryHour,
  readRecordsByRankingHour,
  readStore,
  readUserIds,
  updateStore
} from "../data/store.js";
import { config } from "../config.js";
import { getNowIso, isAfter, subtractHours, toHourKey } from "../utils/time.js";
import {
  STANDARD_CATEGORIES,
  findStandardCategoryById,
  findStandardCategoryByName
} from "../constants/standard-categories.js";

const SHORT_VIDEO_RANKING = "\u77ed\u89c6\u9891\u699c";

function isObjectPlaceholderText(value) {
  return String(value || "").replace(/\s+/g, "").toLowerCase() === "[objectobject]";
}

function normalizeRange(value) {
  if (value && typeof value === "object") {
    const candidates = [
      value.value,
      value.val,
      value.range,
      value.rangeValue,
      value.range_value,
      value.showValue,
      value.show_value,
      value.displayValue,
      value.display_value,
      value.text,
      value.label,
      value.desc
    ];
    const direct = candidates.find((item) => item != null && String(item).trim());
    if (direct != null) {
      return normalizeRange(direct);
    }

    const min = value.min ?? value.lower ?? value.start ?? value.from;
    const max = value.max ?? value.upper ?? value.end ?? value.to;
    if (min != null || max != null) {
      return normalizeRange(`${min ?? ""}-${max ?? ""}`);
    }

    return "";
  }

  if (value == null) {
    return "";
  }

  const text = String(value).trim();
  if (/^(https?:)?\/\//i.test(text) || /^www\./i.test(text)) {
    return "";
  }
  if (/^(true|false)$/i.test(text.replace(/\s+/g, ""))) {
    return "";
  }
  if (isObjectPlaceholderText(text)) {
    return "";
  }
  const compact = text.replace(/\s+/g, "");
  const withoutLabel = compact.replace(
    /^(?:短视频)?(?:用户)?(?:支付金额|点击次数|成交件数|支付区间|点击区间|成交区间|支付|点击|成交)/,
    ""
  );
  if (withoutLabel !== compact) {
    return normalizeRange(withoutLabel);
  }
  if (compact.length > 28 && /[\u4e00-\u9fa5]{5,}/.test(compact) && /[-~]/.test(compact)) {
    return "";
  }

  return text;
}

function normalizeCompareText(value) {
  return String(value || "").replace(/\s+/g, "").trim().toLowerCase();
}

function looksLikeRankBadgeUrl(value) {
  const url = String(value || "").toLowerCase();
  return /rank|ranking|top|badge|medal|crown|champion|first|second|third/.test(url);
}

function sanitizeProductImage(value) {
  const url = String(value || "").trim();
  if (!url) {
    return "";
  }
  if (looksLikeRankBadgeUrl(url) || /avatar|logo|shop|store|qrcode|aweme-qrcode/i.test(url)) {
    return "";
  }
  return url;
}

function normalizeRankingType(value) {
  return String(value || "").replace(/\s+/g, "").trim();
}

function makeCategoryId(categoryId, categoryName) {
  const standardById = findStandardCategoryById(categoryId);
  if (standardById) {
    return standardById.id;
  }

  const standardByName = findStandardCategoryByName(categoryName);
  if (standardByName) {
    return standardByName.id;
  }

  const explicitId = String(categoryId || "").trim();
  if (explicitId) {
    return explicitId;
  }

  const normalizedName = String(categoryName || "").replace(/\s+/g, "").trim();
  return normalizedName ? `name:${normalizedName}` : "";
}

function normalizeCategoryNameToStandard(categoryId, categoryName) {
  return (
    findStandardCategoryById(categoryId)?.name ||
    findStandardCategoryByName(categoryName)?.name ||
    String(categoryName || "").trim()
  );
}

function isShortVideoRanking(value) {
  return normalizeRankingType(value) === SHORT_VIDEO_RANKING;
}

function isHeaderLikeRecord(record) {
  return (
    normalizeCompareText(record.productName) === "商品" &&
    (/支付金额|支付区间/.test(String(record.paymentRange || "")) ||
      /点击次数|点击区间/.test(String(record.clickRange || "")) ||
      /成交件数|成交区间/.test(String(record.orderRange || "")))
  );
}

function makeRecordKey(record) {
  const productId = String(record.productId || "").trim();
  const productUrl = String(record.productUrl || "").trim();
  const productName = normalizeCompareText(record.productName);
  const shopName = normalizeCompareText(record.shopName);
  const videoId = String(record.videoId || "").trim();

  const identity =
    productId ||
    productUrl ||
    (productName ? `${productName}::${shopName}` : "") ||
    videoId;

  return [
    makeCategoryId(record.categoryId, record.categoryName),
    identity,
    String(record.rankingType || "short-video").trim()
  ].join("::");
}

function getChinaTodayStartIso(date = new Date()) {
  const chinaOffsetMs = 8 * 60 * 60 * 1000;
  const chinaNow = new Date(date.getTime() + chinaOffsetMs);
  const chinaDayStartUtcMs = Date.UTC(
    chinaNow.getUTCFullYear(),
    chinaNow.getUTCMonth(),
    chinaNow.getUTCDate()
  );
  return new Date(chinaDayStartUtcMs - chinaOffsetMs).toISOString();
}

function getChinaNaturalDayRetentionCutoffIso(date = new Date(), daysToKeep = 2) {
  const chinaOffsetMs = 8 * 60 * 60 * 1000;
  const chinaNow = new Date(date.getTime() + chinaOffsetMs);
  const chinaTodayStartUtcMs = Date.UTC(
    chinaNow.getUTCFullYear(),
    chinaNow.getUTCMonth(),
    chinaNow.getUTCDate()
  );
  return new Date(chinaTodayStartUtcMs - (Math.max(1, daysToKeep) - 1) * 24 * 60 * 60 * 1000 - chinaOffsetMs).toISOString();
}

function toPositiveInt(value, fallback, min = 1, max = 500) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }
  return Math.min(Math.max(Math.floor(parsed), min), max);
}

function paginateItems(items, options = {}) {
  const page = toPositiveInt(options.page, 1, 1, 100000);
  const pageSize = toPositiveInt(options.pageSize, 50, 1, 200);
  const total = items.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(page, totalPages);
  const start = (safePage - 1) * pageSize;

  return {
    items: items.slice(start, start + pageSize),
    total,
    page: safePage,
    pageSize,
    totalPages
  };
}

function isAtOrAfterIso(value, baselineIso) {
  const time = new Date(value || "").getTime();
  const baseline = new Date(baselineIso || "").getTime();
  return Number.isFinite(time) && Number.isFinite(baseline) && time >= baseline;
}

function sanitizeRecord(input, batch) {
  const capturedAt = batch.capturedAt;

  return {
    id: nanoid(),
    batchId: batch.id,
    captureHour: toHourKey(capturedAt),
    categoryId: makeCategoryId(input.categoryId, input.categoryName || batch.categoryName),
    categoryName: normalizeCategoryNameToStandard(
      input.categoryId || batch.categoryId,
      input.categoryName || batch.categoryName
    ),
    rankingType: input.rankingType || SHORT_VIDEO_RANKING,
    page: Number(input.page || 1),
    rank: Number(input.rank || 0),
    productId: input.productId || "",
    productName: input.productName || "",
    productUrl: input.productUrl || "",
    productImage: sanitizeProductImage(input.productImage),
    shopName: input.shopName || "",
    shopUrl: input.shopUrl || "",
    videoId: input.videoId || "",
    videoTitle: input.videoTitle || "",
    videoUrl: input.videoUrl || "",
    videoCover: input.videoCover || "",
    videoPublishedAt: input.videoPublishedAt || "",
    videos: Array.isArray(input.videos)
      ? input.videos.map((video) => ({
          videoId: video.videoId || "",
          videoTitle: video.videoTitle || "",
          videoUrl: video.videoUrl || "",
          videoCover: video.videoCover || "",
          videoPublishedAt: video.videoPublishedAt || "",
          paymentRange: video.paymentRange || "",
          clickRange: video.clickRange || "",
          orderRange: video.orderRange || "",
          videoCountRange: video.videoCountRange || "",
          creatorName: video.creatorName || ""
        }))
      : [],
    detectedVideoCount: Number(input.detectedVideoCount || 0),
    paymentRange: normalizeRange(input.paymentRange),
    clickRange: normalizeRange(input.clickRange),
    orderRange: normalizeRange(input.orderRange),
    videoCountRange: normalizeRange(input.videoCountRange),
    isCompassFirstListed: Boolean(input.isCompassFirstListed),
    creatorName: input.creatorName || "",
    sourceUrl: batch.sourceUrl,
    capturedAt
  };
}

function isTrustedBatch(batch) {
  return (
    Number(batch?.captureSchemaVersion || 0) >= 4 &&
    isShortVideoRanking(batch?.rankingType) &&
    isCompleteEnoughBatch(batch)
  );
}

function isCompleteEnoughBatch(batch) {
  const pageLimit = Number(batch?.pageLimit || 10);
  const recordCount = Number(batch?.recordCount || 0);

  if (pageLimit >= 2 && recordCount <= 10) {
    return false;
  }

  if (pageLimit >= 10 && recordCount < 80) {
    return false;
  }

  return true;
}

function getBatchRecords(store, batchId) {
  return store.records.filter((record) => record.batchId === batchId);
}

function getRecordQuality(records) {
  const count = (predicate) => records.filter(predicate).length;
  return {
    total: records.length,
    withProductImage: count((record) => String(record.productImage || "").trim()),
    withPaymentRange: count((record) => String(record.paymentRange || "").trim()),
    withClickRange: count((record) => String(record.clickRange || "").trim()),
    withOrderRange: count((record) => String(record.orderRange || "").trim()),
    withVideoSignal: count(
      (record) =>
        String(record.videoUrl || "").trim() ||
        String(record.videoPublishedAt || "").trim() ||
        String(record.videoCountRange || "").trim() ||
        (Array.isArray(record.videos) && record.videos.length > 0)
    )
  };
}

function isSuspiciousRankingQuality(records) {
  const quality = getRecordQuality(records);

  if (quality.total >= 80 && quality.withVideoSignal < 60) {
    return true;
  }

  return false;
}

function isDomFallbackBatch(batch) {
  return String(batch?.captureFallbackMode || "") === "dom" || Number(batch?.domFallbackPages || 0) > 0;
}

function hasMeaningfulVideoRecords(store, batchId) {
  const batch = store.captureBatches.find((entry) => entry.id === batchId);
  const records = getBatchRecords(store, batchId);
  if (!isDomFallbackBatch(batch) && isSuspiciousRankingQuality(records)) {
    return false;
  }

  const strongVideoRows = records.filter(
    (record) => record.videoTitle || record.videoPublishedAt || record.videoCountRange
  ).length;
  return isDomFallbackBatch(batch) ? records.length >= 80 : strongVideoRows >= 3;
}

function hasRankingStart(store, batchId) {
  const records = getBatchRecords(store, batchId);
  return records.some((record) => Number(record.rank) === 1);
}

function getLatestTrustedBatches(store, categoryId, limit = 2) {
  return store.captureBatches
    .filter((batch) => String(batch.categoryId || "") === String(categoryId))
    .filter(isTrustedBatch)
    .filter((batch) => hasRankingStart(store, batch.id))
    .filter((batch) => hasMeaningfulVideoRecords(store, batch.id))
    .sort((left, right) => (left.capturedAt < right.capturedAt ? 1 : -1))
    .slice(0, limit);
}

function getLatestTrustedBatchesFast(categoryId, limit = 2) {
  const candidates = readBatchesByCategory(categoryId, 16).filter(isTrustedBatch);
  const trusted = [];

  for (const batch of candidates) {
    const records = readRecordsByBatchIds([batch.id]);
    if (
      records.some((record) => Number(record.rank) === 1) &&
      (isDomFallbackBatch(batch) || !isSuspiciousRankingQuality(records)) &&
      (
        isDomFallbackBatch(batch) ||
        records.filter((record) => record.videoTitle || record.videoPublishedAt || record.videoCountRange).length >= 3
      )
    ) {
      trusted.push(batch);
    }

    if (trusted.length >= limit) {
      break;
    }
  }

  return trusted;
}

function isTrustedBatchWithRecords(batch, records) {
  return (
    records.some((record) => Number(record.rank) === 1) &&
    (isDomFallbackBatch(batch) || !isSuspiciousRankingQuality(records)) &&
    (
      isDomFallbackBatch(batch) ||
      records.filter((record) => record.videoTitle || record.videoPublishedAt || record.videoCountRange).length >= 3
    )
  );
}

function getTodayTrustedBatchEntries(categoryId, limit = 300) {
  const todayStartIso = getChinaTodayStartIso();
  const candidates = readBatchesByCategory(categoryId, limit)
    .filter(isTrustedBatch)
    .filter((batch) => isAtOrAfterIso(batch.capturedAt, todayStartIso))
    .sort((left, right) => String(left.capturedAt || "").localeCompare(String(right.capturedAt || "")));
  const entries = [];

  for (const batch of candidates) {
    const records = readRecordsByBatchIds([batch.id])
      .filter((record) => isShortVideoRanking(record.rankingType))
      .filter((record) => record.productName || record.videoTitle)
      .filter((record) => !isHeaderLikeRecord(record));

    if (isTrustedBatchWithRecords(batch, records)) {
      entries.push({ batch, records });
    }
  }

  return entries;
}

function getTodayFirstListedSummary(categoryId) {
  const entries = getTodayTrustedBatchEntries(categoryId);
  const baselineEntry = entries[0] || null;
  const baselineKeys = new Set((baselineEntry?.records || []).map((record) => makeRecordKey(record)));
  const firstByKey = new Map();

  for (const entry of entries.slice(1)) {
    for (const record of entry.records) {
      const key = makeRecordKey(record);
      if (!key || baselineKeys.has(key) || firstByKey.has(key)) {
        continue;
      }
      firstByKey.set(key, {
        record,
        batch: entry.batch
      });
    }
  }

  return {
    baselineBatch: baselineEntry?.batch || null,
    latestBatch: entries.at(-1)?.batch || null,
    batchCount: entries.length,
    firstByKey,
    keySet: new Set(firstByKey.keys())
  };
}

function trimHistory(store) {
  const cutoff = getChinaNaturalDayRetentionCutoffIso();
  store.captureBatches = store.captureBatches.filter((batch) => isAfter(batch.capturedAt, cutoff));
  const allowedBatchIds = new Set(store.captureBatches.map((batch) => batch.id));
  store.records = store.records.filter((record) => allowedBatchIds.has(record.batchId));
  return store;
}

function ensureCategory(store, payload) {
  const categoryId = makeCategoryId(payload.categoryId, payload.categoryName);
  const categoryName = normalizeCategoryNameToStandard(payload.categoryId, payload.categoryName);

  if (!categoryId || !categoryName) {
    return;
  }

  const existing = store.categories.find((entry) => entry.id === categoryId);
  if (existing) {
    if (existing.name !== categoryName) {
      existing.name = categoryName;
    }
    return;
  }

  store.categories.push({
    id: categoryId,
    name: categoryName,
    code: categoryName.split("/").join("-").toLowerCase(),
    ownerUserIds: store.users.map((user) => user.id),
    createdAt: getNowIso()
  });
}

function makeCategoryForPayload(payload) {
  const categoryId = makeCategoryId(payload.categoryId, payload.categoryName);
  const categoryName = normalizeCategoryNameToStandard(payload.categoryId, payload.categoryName);

  if (!categoryId || !categoryName) {
    return null;
  }

  return {
    id: categoryId,
    name: categoryName,
    code: categoryName.split("/").join("-").toLowerCase(),
    ownerUserIds: readUserIds(),
    createdAt: getNowIso()
  };
}

export function saveCapture(payload) {
  const pageLimit = Number(payload.pageLimit || 10);
  const recordCount = Array.isArray(payload.records) ? payload.records.length : 0;

  if (pageLimit >= 2 && recordCount <= 10) {
    const error = new Error(
      `采集结果不足，已拒绝写入：目标 ${pageLimit} 页，实际 ${recordCount} 条。请刷新罗盘页面并确认插件版本后重试。`
    );
    error.statusCode = 422;
    throw error;
  }

  if (pageLimit >= 10 && recordCount < 80) {
    const error = new Error(
      `采集结果不足，已拒绝写入：目标约 ${pageLimit * 10} 条，实际 ${recordCount} 条。`
    );
    error.statusCode = 422;
    throw error;
  }

  const batch = {
    id: nanoid(),
    createdByUserId: payload.createdByUserId || "",
    categoryId: makeCategoryId(payload.categoryId, payload.categoryName),
    categoryName: normalizeCategoryNameToStandard(payload.categoryId, payload.categoryName),
    rankingType: payload.rankingType || SHORT_VIDEO_RANKING,
    sourceUrl: payload.sourceUrl || "",
    capturedAt: payload.capturedAt || getNowIso(),
    captureSchemaVersion: Number(payload.captureSchemaVersion || 0),
    captureFallbackMode: payload.captureFallbackMode || "",
    domFallbackPages: Number(payload.domFallbackPages || 0),
    latestApiCapturedAt: Number(payload.latestApiCapturedAt || 0),
    pageLimit: Number(payload.pageLimit || 10),
    recordCount: Array.isArray(payload.records) ? payload.records.length : 0,
    triggerMode: payload.triggerMode || "manual"
  };

  const normalized = (payload.records || []).map((entry) => sanitizeRecord(entry, batch));

  if (pageLimit >= 10 && !isDomFallbackBatch(batch) && isSuspiciousRankingQuality(normalized)) {
    const error = new Error(
      "采集结果疑似不是短视频榜单数据，已拒绝写入。请刷新罗盘页面，确认停留在短视频榜 / 实时数据后重试。"
    );
    error.statusCode = 422;
    throw error;
  }

  const category = makeCategoryForPayload(payload);
  if (category) {
    appendCaptureBatch({
      category,
      batch,
      records: normalized,
      cutoff: subtractHours(getNowIso(), config.historyRetentionHours)
    });
  } else {
    updateStore((store) => {
      trimHistory(store);
      ensureCategory(store, payload);
      store.captureBatches.push(batch);
      store.records.push(...normalized);
      return store;
    });
  }

  return batch;
}

export function getCategoriesForUser(user) {
  const storeCategories = readCategories();
  const categoryStats = readCategoryStats();
  const standardCategoryOrder = new Map(
    STANDARD_CATEGORIES.map((category, index) => [category.id, index])
  );
  const visibleStoreCategories =
    user.role === "admin"
      ? storeCategories
      : storeCategories.filter((entry) => entry.ownerUserIds.includes(user.id));
  const visibleCategoryIds = new Set(visibleStoreCategories.map((entry) => String(entry.id || "")));

  const standardCategories = STANDARD_CATEGORIES.map((category) => {
    const existing = storeCategories.find((entry) => String(entry.id || "") === category.id);
    const stats = categoryStats.get(category.id) || { recordCount: 0, latestCapturedAt: "" };
    return {
      ...(existing || {}),
      id: category.id,
      name: category.name,
      code: existing?.code || category.name.split("/").join("-").toLowerCase(),
      level1: category.level1,
      level2: category.level2,
      isStandard: true,
      hasData: stats.recordCount > 0,
      latestCapturedAt: stats.latestCapturedAt || ""
    };
  });

  const extraCategories = visibleStoreCategories
    .filter((category) => !findStandardCategoryById(category.id) && !findStandardCategoryByName(category.name))
    .map((category) => {
      const stats = categoryStats.get(String(category.id || "")) || { recordCount: 0, latestCapturedAt: "" };
      return {
        ...category,
        isStandard: false,
        hasData: stats.recordCount > 0,
        latestCapturedAt: stats.latestCapturedAt || ""
      };
    });

  const visibleCategories =
    user.role === "admin"
      ? [...standardCategories, ...extraCategories]
      : [...standardCategories.filter((category) => visibleCategoryIds.has(category.id)), ...extraCategories];

  return visibleCategories
    .sort((left, right) => {
      const leftOrder = standardCategoryOrder.get(String(left.id)) ?? Number.MAX_SAFE_INTEGER;
      const rightOrder = standardCategoryOrder.get(String(right.id)) ?? Number.MAX_SAFE_INTEGER;
      if (leftOrder !== rightOrder) {
        return leftOrder - rightOrder;
      }
      return String(left.name || "").localeCompare(String(right.name || ""), "zh-Hans-CN");
    })
    .filter((category, index, list) => {
      return list.findIndex((entry) => entry.name === category.name) === index;
    });
}

export function getVisibleRecords(user, filters = {}) {
  const allowedCategoryIds = new Set(getCategoriesForUser(user).map((entry) => entry.id));

  if (filters.categoryId && !allowedCategoryIds.has(String(filters.categoryId))) {
    return [];
  }

  if (filters.categoryId && filters.captureHour) {
    return readRecordsByCategoryHour(filters.categoryId, filters.captureHour, 500)
      .filter((record) => isShortVideoRanking(record.rankingType))
      .filter((record) => record.productName || record.videoTitle)
      .filter((record) => !isHeaderLikeRecord(record))
      .sort((left, right) => left.rank - right.rank);
  }

  if (filters.categoryId && !filters.captureHour) {
    const latestBatches = getLatestTrustedBatchesFast(filters.categoryId, 1);
    const latestBatch = latestBatches[0];
    if (!latestBatch) {
      return [];
    }

    return readRecordsByCategoryAndBatchIds(filters.categoryId, [latestBatch.id])
      .filter((record) => isShortVideoRanking(record.rankingType))
      .filter((record) => record.productName || record.videoTitle)
      .filter((record) => !isHeaderLikeRecord(record))
      .sort((left, right) => left.rank - right.rank);
  }

  const store = readStore();
  let records = store.records
    .filter((record) => allowedCategoryIds.has(String(record.categoryId || "")))
    .filter((record) => isShortVideoRanking(record.rankingType))
    .filter((record) => record.productName || record.videoTitle)
    .filter((record) => !isHeaderLikeRecord(record))
    .filter((record) => !filters.categoryId || String(record.categoryId || "") === String(filters.categoryId))
    .filter((record) => !filters.captureHour || record.captureHour === filters.captureHour);

  if (filters.categoryId && !filters.captureHour) {
    const latestBatch = store.captureBatches
      .filter((batch) => String(batch.categoryId || "") === String(filters.categoryId))
      .filter(isTrustedBatch)
      .filter((batch) => hasRankingStart(store, batch.id))
      .filter((batch) => hasMeaningfulVideoRecords(store, batch.id))
      .sort((left, right) => (left.capturedAt < right.capturedAt ? 1 : -1))
      .find((batch) =>
        records.some(
          (record) =>
            record.batchId === batch.id &&
            (record.productName || record.videoTitle)
        )
      );

    if (latestBatch) {
      records = records.filter((record) => record.batchId === latestBatch.id);
    } else {
      records = [];
    }
  }

  return records.sort((left, right) => {
    if (left.captureHour === right.captureHour) {
      return left.rank - right.rank;
    }
    return left.captureHour < right.captureHour ? 1 : -1;
  });
}

function buildRankingRowKey(record) {
  const productId = String(record.productId || "").trim();
  const productName = String(record.productName || "").trim();
  const shopName = String(record.shopName || "").trim();
  const productUrl = String(record.productUrl || "").trim();

  return productId || productUrl || `${productName}::${shopName}`;
}

function uniqueVideos(records) {
  const seen = new Set();
  const videos = [];

  for (const record of records) {
    const nestedVideos = Array.isArray(record.videos) && record.videos.length
      ? record.videos
      : [{
          videoId: record.videoId || "",
          videoTitle: record.videoTitle || "",
          videoUrl: record.videoUrl || "",
          videoCover: record.videoCover || "",
          videoPublishedAt: record.videoPublishedAt || "",
          paymentRange: record.paymentRange || "",
          clickRange: record.clickRange || "",
          orderRange: record.orderRange || "",
          videoCountRange: record.videoCountRange || "",
          creatorName: record.creatorName || ""
        }];

    for (const video of nestedVideos) {
      const videoKey =
        String(video.videoId || "").trim() ||
        String(video.videoUrl || "").trim() ||
        `${video.videoTitle || ""}::${video.videoPublishedAt || ""}::${video.videoCover || ""}`;

      if (!videoKey || seen.has(videoKey)) {
        continue;
      }

      seen.add(videoKey);
      videos.push({
        videoId: video.videoId || "",
        videoTitle: video.videoTitle || "",
        videoUrl: video.videoUrl || "",
        videoCover: video.videoCover || "",
        videoPublishedAt: video.videoPublishedAt || "",
        paymentRange: video.paymentRange || "",
        clickRange: video.clickRange || "",
        orderRange: video.orderRange || "",
        videoCountRange: video.videoCountRange || "",
        creatorName: video.creatorName || ""
      });
    }
  }

  return videos;
}

function buildRecordBackfillIndex(records) {
  const index = new Map();
  const sorted = [...records].sort((left, right) => String(right.capturedAt || "").localeCompare(String(left.capturedAt || "")));

  for (const record of sorted) {
    const key = buildRankingRowKey(record);
    if (!key) {
      continue;
    }

    if (!index.has(key)) {
      index.set(key, {
        productImage: "",
        paymentRange: "",
        clickRange: "",
        orderRange: "",
        videosById: new Map()
      });
    }

    const entry = index.get(key);
    entry.productImage ||= sanitizeProductImage(record.productImage);
    entry.paymentRange ||= record.paymentRange || "";
    entry.clickRange ||= record.clickRange || "";
    entry.orderRange ||= record.orderRange || "";

    for (const video of uniqueVideos([record])) {
      const videoKey = String(video.videoId || "").trim() || String(video.videoUrl || "").trim();
      if (!videoKey) {
        continue;
      }
      const existing = entry.videosById.get(videoKey) || {};
      entry.videosById.set(videoKey, {
        ...existing,
        videoCover: existing.videoCover || video.videoCover || "",
        videoTitle: existing.videoTitle || video.videoTitle || "",
        videoPublishedAt: existing.videoPublishedAt || video.videoPublishedAt || "",
        creatorName: existing.creatorName || video.creatorName || ""
      });
    }
  }

  return index;
}

function backfillRecordForDisplay(record, backfillIndex) {
  const key = buildRankingRowKey(record);
  const fill = key ? backfillIndex.get(key) : null;
  if (!fill) {
    return record;
  }

  const videos = uniqueVideos([record]).map((video) => {
    const videoKey = String(video.videoId || "").trim() || String(video.videoUrl || "").trim();
    const videoFill = videoKey ? fill.videosById.get(videoKey) : null;
    if (!videoFill) {
      return video;
    }
    return {
      ...video,
      videoCover: video.videoCover || videoFill.videoCover || "",
      videoTitle: video.videoTitle || videoFill.videoTitle || "",
      videoPublishedAt: video.videoPublishedAt || videoFill.videoPublishedAt || "",
      creatorName: video.creatorName || videoFill.creatorName || ""
    };
  });

  return {
    ...record,
    productImage: sanitizeProductImage(record.productImage) || fill.productImage || "",
    paymentRange: record.paymentRange || fill.paymentRange || "",
    clickRange: record.clickRange || fill.clickRange || "",
    orderRange: record.orderRange || fill.orderRange || "",
    videoCover: record.videoCover || videos.find((video) => video.videoCover)?.videoCover || "",
    videos
  };
}

function parseRangeLevel(value) {
  const text = String(value || "").replace(/\s+/g, "");
  if (!text || /^(https?:)?\/\//i.test(text)) {
    return null;
  }

  const normalized = text.replace(/[¥￥元,，]/g, "").toLowerCase();
  const values = [];
  const pattern = /(\d+(?:\.\d+)?)(万|w|千|k|百|b)?/gi;
  let match;
  while ((match = pattern.exec(normalized))) {
    const unit = String(match[2] || "");
    let parsed = Number(match[1]);
    if (!Number.isFinite(parsed)) {
      continue;
    }
    if (unit === "万" || unit === "w") {
      parsed *= 10000;
    } else if (unit === "千" || unit === "k") {
      parsed *= 1000;
    } else if (unit === "百" || unit === "b") {
      parsed *= 100;
    }
    values.push(parsed);
  }

  return values.length ? Math.max(...values) : null;
}

function parseCleanRangeLevel(value) {
  const text = String(value || "").replace(/\s+/g, "");
  if (!text || text.length > 28 || !/[-~]/.test(text) || !/\d/.test(text) || /^(https?:)?\/\//i.test(text)) {
    return null;
  }
  const cjkCount = Array.from(text).filter((ch) => {
    const code = ch.charCodeAt(0);
    return code >= 0x4e00 && code <= 0x9fff;
  }).length;
  if (cjkCount >= 5) {
    return null;
  }

  const normalized = text
    .replace(/\uFFE5|\u00A5|,|\u5143/g, "")
    .replace(/\u4e07/g, "w")
    .replace(/\u5343/g, "k")
    .toLowerCase();
  const values = [];
  const pattern = /(\d+(?:\.\d+)?)(w|k)?/gi;
  let match;
  while ((match = pattern.exec(normalized))) {
    let parsed = Number(match[1]);
    if (!Number.isFinite(parsed)) {
      continue;
    }
    if (match[2] === "w") {
      parsed *= 10000;
    } else if (match[2] === "k") {
      parsed *= 1000;
    }
    values.push(parsed);
  }
  return values.length ? Math.max(...values) : null;
}

function buildDiffItem(label, previousValue, currentValue, kind) {
  const previousText = previousValue || "";
  const currentText = currentValue || "";
  if (previousText === currentText) {
    return null;
  }

  const previousLevel = parseCleanRangeLevel(previousText);
  const currentLevel = parseCleanRangeLevel(currentText);
  if (previousLevel == null || currentLevel == null) {
    return null;
  }
  const direction =
    previousLevel != null && currentLevel != null
      ? currentLevel > previousLevel
        ? "up"
        : currentLevel < previousLevel
          ? "down"
          : "changed"
      : "changed";

  return {
    label,
    kind,
    previous: previousText,
    current: currentText,
    text: `${label} ${previousText || "-"} -> ${currentText || "-"}`,
    direction,
    isRangeJump: direction === "up"
  };
}

function buildQualitySummary(rows) {
  const total = rows.length;
  const count = (predicate) => rows.filter(predicate).length;
  return {
    total,
    paymentFilled: count((row) => row.paymentRange),
    clickFilled: count((row) => row.clickRange),
    orderFilled: count((row) => row.orderRange),
    productImageFilled: count((row) => row.productImage),
    videoCoverFilled: count((row) => (row.videos || []).some((video) => video.videoCover)),
    videoFilled: count((row) => (row.videos || []).length > 0)
  };
}

function parseRangeLevelForRawRows(value) {
  return parseCleanRangeLevel(value);
}

function buildRawRowDiffItem(label, previousValue, currentValue, kind) {
  const previousText = previousValue || "";
  const currentText = currentValue || "";
  if (previousText === currentText) {
    return null;
  }

  const previousLevel = parseRangeLevelForRawRows(previousText);
  const currentLevel = parseRangeLevelForRawRows(currentText);
  if (previousLevel == null || currentLevel == null) {
    return null;
  }
  const direction =
    previousLevel != null && currentLevel != null
      ? currentLevel > previousLevel
        ? "up"
        : currentLevel < previousLevel
          ? "down"
          : "changed"
      : "changed";

  return {
    label,
    kind,
    previous: previousText,
    current: currentText,
    text: `${label} ${previousText || "-"} -> ${currentText || "-"}`,
    direction,
    isRangeJump: direction === "up"
  };
}

function isVisibleDiffItem(item) {
  if (!item || item.kind === "videoCount") {
    return false;
  }
  const text = `${item.label || ""} ${item.text || ""}`;
  return !/视频数|video\s*count/i.test(text);
}

function hasVisibleDiffItems(row) {
  return (Array.isArray(row.diffItems) ? row.diffItems : []).some(isVisibleDiffItem);
}

function buildRankingRawRow(record, previous, latestBatches, todayFirstListed = null) {
  const videos = uniqueVideos([record]);
  const diffItems = previous
    ? [
        buildRawRowDiffItem("支付", previous.paymentRange, record.paymentRange, "payment"),
        buildRawRowDiffItem("点击", previous.clickRange, record.clickRange, "click"),
        buildRawRowDiffItem("成交", previous.orderRange, record.orderRange, "order"),
        buildRawRowDiffItem("视频数", previous.videoCountRange, record.videoCountRange, "videoCount")
      ].filter(isVisibleDiffItem)
    : [];
  const statusTags = [];

  const isTodayNew = Boolean(todayFirstListed?.isTodayFirstListed);

  if (!previous && !isTodayNew) {
    statusTags.push("新增商品");
  }
  if (previous && previous.rank !== record.rank) {
    statusTags.push(record.rank < previous.rank ? "排名上升" : "排名变化");
  }
  if (diffItems.some((item) => item.kind === "payment" && item.direction === "up")) {
    statusTags.push("支付上升");
  }
  if (diffItems.some((item) => item.kind === "click" && item.direction === "up")) {
    statusTags.push("点击上升");
  }
  if (diffItems.some((item) => item.kind === "order" && item.direction === "up")) {
    statusTags.push("成交上升");
  }
  if (diffItems.some((item) => ["payment", "click", "order"].includes(item.kind) && item.isRangeJump)) {
    statusTags.push("区间跳跃");
  }
  if (isTodayNew) {
    statusTags.push("今日新增");
  }

  return {
    id: record.id,
    batchId: record.batchId,
    captureHour: record.captureHour,
    capturedAt: record.capturedAt,
    categoryId: record.categoryId,
    categoryName: record.categoryName,
    rankingType: record.rankingType,
    page: record.page,
    rank: record.rank,
    productId: record.productId,
    productName: record.productName,
    productUrl: record.productUrl,
    productImage: sanitizeProductImage(record.productImage),
    shopName: record.shopName,
    shopUrl: record.shopUrl,
    sourceUrl: record.sourceUrl,
    videos,
    videoCount: Number(record.detectedVideoCount || record.videoCountRange || videos.length || 0),
    latestVideoPublishedAt: videos
      .map((video) => video.videoPublishedAt)
      .filter(Boolean)
      .sort()
      .reverse()[0] || "",
    paymentRange: record.paymentRange || "",
    clickRange: record.clickRange || "",
    orderRange: record.orderRange || "",
    previousPaymentRange: previous?.paymentRange || "",
    previousClickRange: previous?.clickRange || "",
    previousOrderRange: previous?.orderRange || "",
    videoCountRange: record.videoCountRange || "",
    isCompassFirstListed: Boolean(record.isCompassFirstListed),
    isTodayFirstListed: Boolean(todayFirstListed?.isTodayFirstListed),
    todayFirstListedAt: todayFirstListed?.firstListedAt || "",
    todayBaselineBatchAt: todayFirstListed?.baselineBatchAt || "",
    isNewcomer: !previous,
    hasDiff: Boolean(!previous || previous.rank !== record.rank || diffItems.length),
    isRangeJump: diffItems.some((item) => item.isRangeJump),
    statusTags: [...new Set(statusTags)],
    diffItems,
    diffChanges: diffItems.map((item) => item.text),
    compareCurrentBatchAt: latestBatches[0]?.capturedAt || "",
    comparePreviousBatchAt: latestBatches[1]?.capturedAt || ""
  };
}

export function getRankingRows(user, filters = {}) {
  if (filters.categoryId && !filters.captureHour) {
    const allowedCategoryIds = new Set(getCategoriesForUser(user).map((entry) => entry.id));
    if (!allowedCategoryIds.has(String(filters.categoryId))) {
      return [];
    }

    const latestBatches = getLatestTrustedBatchesFast(filters.categoryId, 2);
    const batchRecords = readRecordsByBatchIds(latestBatches.map((batch) => batch.id))
      .filter((record) => isShortVideoRanking(record.rankingType))
      .filter((record) => record.productName || record.videoTitle)
      .filter((record) => !isHeaderLikeRecord(record));
    const backfillRecords = readRecentRecordsByCategory(filters.categoryId, 1200)
      .filter((record) => isShortVideoRanking(record.rankingType));
    const backfillIndex = buildRecordBackfillIndex(backfillRecords);
    const currentBatchId = latestBatches[0]?.id || null;
    const previousBatchId = latestBatches[1]?.id || null;
    const previousBatchRecords = previousBatchId
      ? batchRecords
          .filter((record) => record.batchId === previousBatchId)
          .map((record) => backfillRecordForDisplay(record, backfillIndex))
      : [];
    const previousByKey = new Map(previousBatchRecords.map((record) => [makeRecordKey(record), record]));
    const todayFirstListedSummary = getTodayFirstListedSummary(filters.categoryId);

    if (!currentBatchId) {
      return [];
    }

    const rawRows = batchRecords
      .filter((record) => record.batchId === currentBatchId)
      .map((record) => backfillRecordForDisplay(record, backfillIndex))
      .sort((left, right) => left.rank - right.rank)
      .map((record) => {
        const key = makeRecordKey(record);
        const firstEntry = todayFirstListedSummary.firstByKey.get(key);
        return buildRankingRawRow(record, previousByKey.get(key), latestBatches, {
          isTodayFirstListed: todayFirstListedSummary.keySet.has(key),
          firstListedAt: firstEntry?.batch?.capturedAt || "",
          baselineBatchAt: todayFirstListedSummary.baselineBatch?.capturedAt || ""
        });
      });
    const qualitySummary = buildQualitySummary(rawRows);
    return rawRows.map((row) => ({ ...row, qualitySummary }));
  }

  const records = getVisibleRecords(user, filters);
  const store = readStore();
  const latestBatches = filters.categoryId ? getLatestTrustedBatches(store, filters.categoryId, 2) : [];
  const backfillIndex = buildRecordBackfillIndex(
    store.records
      .filter((record) => isShortVideoRanking(record.rankingType))
      .filter((record) => !filters.categoryId || String(record.categoryId || "") === String(filters.categoryId))
  );
  const currentBatchId = latestBatches[0]?.id || null;
  const previousBatchId = latestBatches[1]?.id || null;
  const previousBatchRecords = previousBatchId
    ? store.records
        .filter((record) => record.batchId === previousBatchId)
        .map((record) => backfillRecordForDisplay(record, backfillIndex))
    : [];
  const previousByKey = new Map(previousBatchRecords.map((record) => [makeRecordKey(record), record]));
  const todayFirstListedSummary = filters.categoryId ? getTodayFirstListedSummary(filters.categoryId) : null;

  if (currentBatchId) {
    const rawRows = records
      .filter((record) => record.batchId === currentBatchId)
      .map((record) => backfillRecordForDisplay(record, backfillIndex))
      .sort((left, right) => left.rank - right.rank)
      .map((record) => {
        const key = makeRecordKey(record);
        const firstEntry = todayFirstListedSummary?.firstByKey.get(key);
        return buildRankingRawRow(record, previousByKey.get(key), latestBatches, {
          isTodayFirstListed: Boolean(todayFirstListedSummary?.keySet.has(key)),
          firstListedAt: firstEntry?.batch?.capturedAt || "",
          baselineBatchAt: todayFirstListedSummary?.baselineBatch?.capturedAt || ""
        });
      });
    const qualitySummary = buildQualitySummary(rawRows);
    return rawRows.map((row) => ({ ...row, qualitySummary }));
  }

  const grouped = new Map();

  for (const record of records.map((entry) => backfillRecordForDisplay(entry, backfillIndex))) {
    const key = buildRankingRowKey(record);
    if (!key) {
      continue;
    }

    if (!grouped.has(key)) {
      grouped.set(key, []);
    }

    grouped.get(key).push(record);
  }

  const rows = [...grouped.values()]
    .map((entries) => {
      const sortedEntries = [...entries].sort((left, right) => left.rank - right.rank);
      const primary = sortedEntries[0];
      const videos = uniqueVideos(sortedEntries);
      const maxDetectedVideoCount = Math.max(
        ...sortedEntries.map((entry) => Number(entry.detectedVideoCount || 0)),
        videos.length
      );
      const compareRecord = currentBatchId
        ? sortedEntries.find((entry) => entry.batchId === currentBatchId) || primary
        : primary;
      const previous = previousByKey.get(makeRecordKey(compareRecord));
      const diffChanges = [];

      if (!previous) {
        diffChanges.push("本次采集新进入榜单");
      } else {
        if (previous.rank !== compareRecord.rank) {
          diffChanges.push(`排名 ${previous.rank} -> ${compareRecord.rank}`);
        }
        if (previous.paymentRange !== compareRecord.paymentRange) {
          diffChanges.push(`支付区间 ${previous.paymentRange || "-"} -> ${compareRecord.paymentRange || "-"}`);
        }
        if (previous.clickRange !== compareRecord.clickRange) {
          diffChanges.push(`点击区间 ${previous.clickRange || "-"} -> ${compareRecord.clickRange || "-"}`);
        }
        if (previous.orderRange !== compareRecord.orderRange) {
          diffChanges.push(`成交区间 ${previous.orderRange || "-"} -> ${compareRecord.orderRange || "-"}`);
        }
      }

      const diffItems = previous
        ? [
            buildDiffItem("支付", previous.paymentRange, compareRecord.paymentRange, "payment"),
            buildDiffItem("点击", previous.clickRange, compareRecord.clickRange, "click"),
            buildDiffItem("成交", previous.orderRange, compareRecord.orderRange, "order"),
            buildDiffItem("视频数", previous.videoCountRange, compareRecord.videoCountRange, "videoCount")
          ].filter(isVisibleDiffItem)
        : [];
      const statusTags = [];

      if (!previous && currentBatchId) {
        statusTags.push("新增商品");
      }
      if (previous && previous.rank !== compareRecord.rank) {
        statusTags.push(compareRecord.rank < previous.rank ? "排名上升" : "排名变化");
      }
      if (diffItems.some((item) => item.kind === "payment" && item.direction === "up")) {
        statusTags.push("支付上升");
      }
      if (diffItems.some((item) => item.kind === "click" && item.direction === "up")) {
        statusTags.push("点击上升");
      }
      if (diffItems.some((item) => item.kind === "order" && item.direction === "up")) {
        statusTags.push("成交上升");
      }
      return {
        id: primary.batchId ? `${primary.batchId}::${buildRankingRowKey(primary)}` : primary.id,
        batchId: primary.batchId,
        captureHour: primary.captureHour,
        capturedAt: primary.capturedAt,
        categoryId: primary.categoryId,
        categoryName: primary.categoryName,
        rankingType: primary.rankingType,
        page: primary.page,
        rank: primary.rank,
        productId: primary.productId,
        productName: primary.productName,
        productUrl: primary.productUrl,
        productImage: sanitizeProductImage(primary.productImage),
        shopName: primary.shopName,
        shopUrl: primary.shopUrl,
        sourceUrl: primary.sourceUrl,
        videos,
        videoCount: maxDetectedVideoCount,
        latestVideoPublishedAt: videos
          .map((video) => video.videoPublishedAt)
          .filter(Boolean)
          .sort()
          .reverse()[0] || "",
        paymentRange: primary.paymentRange || "",
        clickRange: primary.clickRange || "",
        orderRange: primary.orderRange || "",
        previousPaymentRange: previous?.paymentRange || "",
        previousClickRange: previous?.clickRange || "",
        previousOrderRange: previous?.orderRange || "",
        videoCountRange: primary.videoCountRange || "",
        isCompassFirstListed: Boolean(sortedEntries.some((entry) => entry.isCompassFirstListed)),
        isNewcomer: !previous && Boolean(currentBatchId),
        hasDiff: Boolean(previous && diffChanges.length),
        isRangeJump: diffItems.some((item) => item.isRangeJump),
        statusTags: [...new Set(statusTags)],
        diffItems,
        diffChanges,
        compareCurrentBatchAt: latestBatches[0]?.capturedAt || "",
        comparePreviousBatchAt: latestBatches[1]?.capturedAt || ""
      };
    })
    .sort((left, right) => left.rank - right.rank);

  const qualitySummary = buildQualitySummary(rows);
  return rows.map((row) => ({ ...row, qualitySummary }));
}

export function getRankingRowsPage(user, filters = {}) {
  const rows = getRankingRows(user, filters);
  const viewMode = String(filters.viewMode || "all");
  const filteredRows = viewMode === "firstListed" || viewMode === "todayNew"
    ? rows.filter((row) => row.isTodayFirstListed)
    : viewMode === "changed"
      ? rows.filter(hasVisibleDiffItems)
      : rows;

  return paginateItems(filteredRows, filters);
}

export function getLatestBatchByCategory(categoryId) {
  return getLatestTrustedBatchesFast(categoryId, 1)[0];
}

export function getOverview(user) {
  const categories = getCategoriesForUser(user);
  const overview = readOverviewStats(SHORT_VIDEO_RANKING);

  return {
    latestHour: overview.latestHour,
    categoryCount: categories.length,
    categoriesWithData: overview.categoriesWithData,
    recordCount: overview.recordCount,
    productCount: overview.productCount
  };
}

export function getHourlyDiffs(user, categoryId) {
  const allowedCategoryIds = new Set(getCategoriesForUser(user).map((entry) => entry.id));
  let records;
  let currentBatchId = null;
  let previousBatchId = null;
  let currentLabel = null;
  let previousLabel = null;

  if (categoryId) {
    if (!allowedCategoryIds.has(String(categoryId))) {
      return { currentHour: null, previousHour: null, newcomers: [], shifts: [] };
    }

    const latestBatches = getLatestTrustedBatchesFast(categoryId, 2);
    const allowedBatchIds = new Set(latestBatches.map((batch) => batch.id));
    currentBatchId = latestBatches[0]?.id || null;
    previousBatchId = latestBatches[1]?.id || null;
    currentLabel = latestBatches[0]?.capturedAt || null;
    previousLabel = latestBatches[1]?.capturedAt || null;

    records = readRecordsByCategoryAndBatchIds(categoryId, [...allowedBatchIds])
      .filter((record) => isShortVideoRanking(record.rankingType))
      .filter((record) => allowedBatchIds.has(record.batchId))
      .filter((record) => record.productName || record.videoTitle)
      .sort((left, right) => {
        if (left.captureHour === right.captureHour) {
          return left.rank - right.rank;
        }
        return left.captureHour < right.captureHour ? 1 : -1;
      });
  } else {
    const hours = readLatestCaptureHours(SHORT_VIDEO_RANKING, 2);
    records = hours
      .flatMap((hour) => readRecordsByRankingHour(SHORT_VIDEO_RANKING, hour, 5000))
      .filter((record) => allowedCategoryIds.has(String(record.categoryId || "")))
      .filter((record) => isShortVideoRanking(record.rankingType))
      .filter((record) => record.productName || record.videoTitle)
      .filter((record) => !isHeaderLikeRecord(record));
  }

  if (categoryId && currentBatchId) {
    const currentRecords = records.filter((entry) => entry.batchId === currentBatchId);
    const previousRecords = previousBatchId
      ? records.filter((entry) => entry.batchId === previousBatchId)
      : [];
    const previousByKey = new Map(previousRecords.map((entry) => [makeRecordKey(entry), entry]));
    const todayFirstListedSummary = getTodayFirstListedSummary(categoryId);
    const todayFirstRecords = [...todayFirstListedSummary.firstByKey.values()]
      .map(({ record, batch }) => ({
        ...record,
        changeType: "newcomer",
        isTodayFirstListed: true,
        todayFirstListedAt: batch?.capturedAt || "",
        todayBaselineBatchAt: todayFirstListedSummary.baselineBatch?.capturedAt || ""
      }))
      .sort((left, right) => {
        const timeDiff = String(left.todayFirstListedAt || "").localeCompare(String(right.todayFirstListedAt || ""));
        return timeDiff || Number(left.rank || 0) - Number(right.rank || 0);
      });

    const shifts = currentRecords
      .map((record) => {
        const previous = previousByKey.get(makeRecordKey(record));
        if (!previous) {
          return null;
        }

        const changes = [];

        if (previous.rank !== record.rank) {
          changes.push(`排名 ${previous.rank} -> ${record.rank}`);
        }

        if (previous.paymentRange !== record.paymentRange) {
          changes.push(`支付区间 ${previous.paymentRange} -> ${record.paymentRange}`);
        }

        if (previous.clickRange !== record.clickRange) {
          changes.push(`点击区间 ${previous.clickRange} -> ${record.clickRange}`);
        }

        if (previous.orderRange !== record.orderRange) {
          changes.push(`成交区间 ${previous.orderRange} -> ${record.orderRange}`);
        }

        if (!changes.length) {
          return null;
        }

        return {
          ...record,
          previousRank: previous.rank,
          previousPaymentRange: previous.paymentRange,
          previousClickRange: previous.clickRange,
          previousOrderRange: previous.orderRange,
          changes
        };
      })
      .filter(Boolean);

    return {
      currentHour: currentLabel,
      previousHour: todayFirstListedSummary.baselineBatch?.capturedAt || previousLabel,
      baselineHour: todayFirstListedSummary.baselineBatch?.capturedAt || null,
      todayBatchCount: todayFirstListedSummary.batchCount,
      currentRecordCount: currentRecords.length,
      previousRecordCount: todayFirstListedSummary.baselineBatch
        ? (todayFirstListedSummary.baselineBatch.recordCount || 0)
        : previousRecords.length,
      newcomerCount: todayFirstRecords.length,
      shiftCount: shifts.length,
      newcomers: todayFirstRecords,
      shifts
    };
  }

  const hours = [...new Set(records.map((entry) => entry.captureHour))].sort().reverse();
  const currentHour = hours[0];
  const previousHour = hours[1];

  if (!currentHour) {
    return { currentHour: null, previousHour: null, newcomers: [], shifts: [] };
  }

  const currentRecords = records.filter((entry) => entry.captureHour === currentHour);
  const previousRecords = records.filter((entry) => entry.captureHour === previousHour);

  const previousByKey = new Map(previousRecords.map((entry) => [makeRecordKey(entry), entry]));

  const newcomers = currentRecords
    .filter((record) => !previousByKey.has(makeRecordKey(record)))
    .map((record) => ({
      ...record,
      changeType: "newcomer"
    }));

  const shifts = currentRecords
    .map((record) => {
      const previous = previousByKey.get(makeRecordKey(record));
      if (!previous) {
        return null;
      }

      const changes = [];

      if (previous.rank !== record.rank) {
        changes.push(`排名 ${previous.rank} -> ${record.rank}`);
      }

      if (previous.paymentRange !== record.paymentRange) {
        changes.push(`支付区间 ${previous.paymentRange} -> ${record.paymentRange}`);
      }

      if (previous.clickRange !== record.clickRange) {
        changes.push(`点击区间 ${previous.clickRange} -> ${record.clickRange}`);
      }

      if (previous.orderRange !== record.orderRange) {
        changes.push(`成交区间 ${previous.orderRange} -> ${record.orderRange}`);
      }

      if (!changes.length) {
        return null;
      }

      return {
        ...record,
        previousRank: previous.rank,
        previousPaymentRange: previous.paymentRange,
        previousClickRange: previous.clickRange,
        previousOrderRange: previous.orderRange,
        changes
      };
    })
    .filter(Boolean);

  return {
    currentHour,
    previousHour,
    currentRecordCount: currentRecords.length,
    previousRecordCount: previousRecords.length,
    newcomerCount: newcomers.length,
    shiftCount: shifts.length,
    newcomers,
    shifts
  };
}

export function getHourlyDiffsPage(user, categoryId, options = {}) {
  const result = getHourlyDiffs(user, categoryId);
  const newcomerPage = paginateItems(result.newcomers || [], options);

  return {
    ...result,
    newcomers: newcomerPage.items,
    newcomerTotal: newcomerPage.total,
    newcomerPage: newcomerPage.page,
    newcomerPageSize: newcomerPage.pageSize,
    newcomerTotalPages: newcomerPage.totalPages,
    newcomerCount: newcomerPage.total
  };
}

export function getCaptureHistory(user, options = {}) {
  const allowedCategoryIds = new Set(getCategoriesForUser(user).map((entry) => entry.id));
  const limit = Math.min(Math.max(Number(options.limit || 300), 50), 1000);

  return readCaptureBatches(limit)
    .filter((entry) => allowedCategoryIds.has(String(entry.categoryId || "")))
    .filter(isTrustedBatch)
    .sort((left, right) => (left.capturedAt < right.capturedAt ? 1 : -1));
}

export function getCaptureHistoryPage(user, options = {}) {
  const limit = Math.min(Math.max(Number(options.limit || 1000), 50), 2000);
  const rows = getCaptureHistory(user, { limit });
  return paginateItems(rows, options);
}

export function getDiagnostics() {
  return readDiagnostics();
}
