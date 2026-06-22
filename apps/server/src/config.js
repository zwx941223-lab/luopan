import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");
const dataDir = path.join(rootDir, "data");

export const config = {
  port: Number(process.env.PORT || 4318),
  jwtSecret: process.env.JWT_SECRET || "dy-monitor-local-secret",
  dataDir,
  corsOrigin: process.env.CORS_ORIGIN || "http://localhost:5173",
  appUrl: process.env.APP_URL || "http://localhost:5173",
  extensionApiToken: process.env.EXTENSION_API_TOKEN || "dy-monitor-extension-token",
  historyRetentionDays: Number(process.env.HISTORY_RETENTION_DAYS || 2),
  autoCaptureIntervalMinutes: Number(process.env.AUTO_CAPTURE_INTERVAL_MINUTES || 90),
  compassCaptureUrl:
    process.env.LUOPAN_CAPTURE_URL ||
    "https://compass.jinritemai.com/shop/chance/product-rank?from_page=%2Fshop%2Fcommodity%2Fproduct-list&btm_ppre=a6187.b901354.c0.d0&btm_pre=a6187.b904798.c0.d0"
};
