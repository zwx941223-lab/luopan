import { Router } from "express";
import ExcelJS from "exceljs";
import { requireAuth, requireExtensionToken } from "../middleware/auth.js";
import {
  getCaptureHistory,
  getHourlyDiffs,
  getLatestBatchByCategory,
  getOverview,
  getRankingRows,
  getVisibleRecords,
  saveCapture
} from "../services/record-service.js";

const router = Router();

router.get("/overview", requireAuth, (req, res) => {
  return res.json(getOverview(req.user));
});

router.get("/records", requireAuth, (req, res) => {
  const records = getVisibleRecords(req.user, {
    categoryId: req.query.categoryId,
    captureHour: req.query.captureHour
  });
  return res.json(records);
});

router.get("/ranking-rows", requireAuth, (req, res) => {
  const rows = getRankingRows(req.user, {
    categoryId: req.query.categoryId,
    captureHour: req.query.captureHour
  });
  return res.json(rows);
});

router.get("/history", requireAuth, (req, res) => {
  return res.json(getCaptureHistory(req.user));
});

router.get("/diffs", requireAuth, (req, res) => {
  return res.json(getHourlyDiffs(req.user, req.query.categoryId));
});

router.get("/latest-batch", requireAuth, (req, res) => {
  if (!req.query.categoryId) {
    return res.status(400).json({ message: "Missing categoryId" });
  }

  return res.json(getLatestBatchByCategory(req.query.categoryId) || null);
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
