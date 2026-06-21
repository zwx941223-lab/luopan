import { Router } from "express";
import ExcelJS from "exceljs";
import { requireAuth, requireExtensionToken } from "../middleware/auth.js";
import {
  getCaptureHistory,
  getDiagnostics,
  getHourlyDiffs,
  getLatestBatchByCategory,
  getOverview,
  getRankingRows,
  getVisibleRecords,
  saveCapture
} from "../services/record-service.js";

const router = Router();

function timedJson(res, startedAt, payload) {
  res.setHeader("X-DY-Monitor-Duration-Ms", String(Date.now() - startedAt));
  return res.json(payload);
}

router.get("/overview", requireAuth, (req, res) => {
  const startedAt = Date.now();
  return timedJson(res, startedAt, getOverview(req.user));
});

router.get("/records", requireAuth, (req, res) => {
  const startedAt = Date.now();
  const records = getVisibleRecords(req.user, {
    categoryId: req.query.categoryId,
    captureHour: req.query.captureHour
  });
  return timedJson(res, startedAt, records);
});

router.get("/ranking-rows", requireAuth, (req, res) => {
  const startedAt = Date.now();
  const rows = getRankingRows(req.user, {
    categoryId: req.query.categoryId,
    captureHour: req.query.captureHour
  });
  return timedJson(res, startedAt, rows);
});

router.get("/history", requireAuth, (req, res) => {
  const startedAt = Date.now();
  return timedJson(res, startedAt, getCaptureHistory(req.user, { limit: req.query.limit }));
});

router.get("/diffs", requireAuth, (req, res) => {
  const startedAt = Date.now();
  return timedJson(res, startedAt, getHourlyDiffs(req.user, req.query.categoryId));
});

router.get("/latest-batch", requireAuth, (req, res) => {
  const startedAt = Date.now();
  if (!req.query.categoryId) {
    return res.status(400).json({ message: "Missing categoryId" });
  }

  return timedJson(res, startedAt, getLatestBatchByCategory(req.query.categoryId) || null);
});

router.get("/diagnostics", requireAuth, (req, res) => {
  const startedAt = Date.now();
  return timedJson(res, startedAt, getDiagnostics());
});

router.post("/capture/upload", requireExtensionToken, (req, res) => {
  try {
    const batch = saveCapture(req.body);
    return res.status(201).json(batch);
  } catch (error) {
    return res.status(error.statusCode || 500).json({
      message: error.message || "Capture upload failed"
    });
  }
});

router.get("/export", requireAuth, async (req, res) => {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("short-video-ranking");
  const records = getVisibleRecords(req.user, {
    categoryId: req.query.categoryId,
    captureHour: req.query.captureHour
  });

  sheet.columns = [
    { header: "capture_hour", key: "captureHour", width: 20 },
    { header: "category_name", key: "categoryName", width: 24 },
    { header: "rank", key: "rank", width: 10 },
    { header: "product_name", key: "productName", width: 40 },
    { header: "shop_name", key: "shopName", width: 24 },
    { header: "video_title", key: "videoTitle", width: 48 },
    { header: "video_published_at", key: "videoPublishedAt", width: 24 },
    { header: "payment_range", key: "paymentRange", width: 18 },
    { header: "click_range", key: "clickRange", width: 18 },
    { header: "order_range", key: "orderRange", width: 18 },
    { header: "video_count_range", key: "videoCountRange", width: 18 }
  ];

  records.forEach((record) => {
    sheet.addRow(record);
  });

  res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  res.setHeader("Content-Disposition", 'attachment; filename="dy-monitor-export.xlsx"');
  await workbook.xlsx.write(res);
  res.end();
});

export default router;
