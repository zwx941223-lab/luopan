import { Router } from "express";
import { requireAuth, requireExtensionToken } from "../middleware/auth.js";
import {
  getCaptureHistory,
  getCaptureHistoryPage,
  getAutoCaptureState,
  getDiagnostics,
  getHourlyDiffsPage,
  getLatestBatchByCategory,
  getOverview,
  getRankingRowsPage,
  getVisibleRecords,
  saveCapture,
  saveCaptureTiming,
  updateAutoCaptureState
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
  const rows = getRankingRowsPage(req.user, {
    categoryId: req.query.categoryId,
    captureHour: req.query.captureHour,
    viewMode: req.query.viewMode,
    page: req.query.page,
    pageSize: req.query.pageSize
  });
  return timedJson(res, startedAt, rows);
});

router.get("/history", requireAuth, (req, res) => {
  const startedAt = Date.now();
  return timedJson(res, startedAt, getCaptureHistoryPage(req.user, {
    limit: req.query.limit,
    page: req.query.page,
    pageSize: req.query.pageSize
  }));
});

router.get("/diffs", requireAuth, (req, res) => {
  const startedAt = Date.now();
  return timedJson(res, startedAt, getHourlyDiffsPage(req.user, req.query.categoryId, {
    page: req.query.page,
    pageSize: req.query.pageSize
  }));
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

router.get("/capture/auto-state", requireExtensionToken, (_req, res) => {
  res.json(getAutoCaptureState());
});

router.post("/capture/auto-state", requireExtensionToken, (req, res) => {
  const action = String(req.body?.action || "").trim();
  if (!action) {
    return res.status(400).json({ message: "Missing action" });
  }
  res.json(updateAutoCaptureState(action, req.body || {}));
});

router.post("/capture/upload", requireExtensionToken, (req, res) => {
  const startedAt = Date.now();
  try {
    const batch = saveCapture(req.body);
    res.setHeader("X-DY-Monitor-Upload-Ms", String(Date.now() - startedAt));
    return res.status(201).json(batch);
  } catch (error) {
    res.setHeader("X-DY-Monitor-Upload-Ms", String(Date.now() - startedAt));
    return res.status(error.statusCode || 500).json({
      message: error.message || "Capture upload failed"
    });
  }
});

router.post("/capture/timing", requireExtensionToken, (req, res) => {
  const batch = saveCaptureTiming(req.body?.batchId, req.body?.timing);
  if (!batch) {
    return res.status(404).json({ message: "Batch not found" });
  }
  return res.json(batch);
});

export default router;
