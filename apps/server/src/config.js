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
  historyRetentionHours: Number(process.env.HISTORY_RETENTION_HOURS || 72)
};
