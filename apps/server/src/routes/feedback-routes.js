import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../middleware/auth.js";
import { appendFeedback, readFeedback } from "../data/store.js";

const router = Router();

const feedbackSchema = z.object({
  content: z.string().trim().min(2).max(1000)
});

router.get("/", requireAuth, (_req, res) => {
  return res.json(readFeedback({ limit: 200 }));
});

router.post("/", requireAuth, (req, res) => {
  const parsed = feedbackSchema.safeParse(req.body);

  if (!parsed.success) {
    return res.status(400).json({ message: "请填写至少 2 个字的反馈内容" });
  }

  const feedback = appendFeedback({
    user: req.user,
    content: parsed.data.content
  });

  return res.status(201).json(feedback);
});

export default router;
