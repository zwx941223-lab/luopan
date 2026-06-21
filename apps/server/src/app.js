import express from "express";
import cors from "cors";
import path from "node:path";
import { fileURLToPath } from "node:url";
import authRoutes from "./routes/auth-routes.js";
import categoryRoutes from "./routes/category-routes.js";
import feedbackRoutes from "./routes/feedback-routes.js";
import monitorRoutes from "./routes/monitor-routes.js";
import { config } from "./config.js";
import { readStore } from "./data/store.js";

readStore();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const webDistDir = path.resolve(__dirname, "../../web/dist");

const app = express();

app.use(
  cors({
    origin: config.corsOrigin.split(",").map((entry) => entry.trim()),
    credentials: false
  })
);
app.use(express.json({ limit: "10mb" }));

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, service: "dy-monitor-server" });
});

app.use("/api/auth", authRoutes);
app.use("/api/categories", categoryRoutes);
app.use("/api/feedback", feedbackRoutes);
app.use("/api/monitor", monitorRoutes);

app.use(express.static(webDistDir));
app.get("*", (_req, res, next) => {
  if (_req.path.startsWith("/api/")) {
    next();
    return;
  }
  res.sendFile(path.join(webDistDir, "index.html"), (error) => {
    if (error) {
      next();
    }
  });
});

export default app;
