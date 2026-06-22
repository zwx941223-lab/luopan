import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../middleware/auth.js";
import { readCategories } from "../data/store.js";
import { login } from "../services/auth-service.js";

const router = Router();

const loginSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1)
});

router.post("/login", (req, res) => {
  const parsed = loginSchema.safeParse(req.body);

  if (!parsed.success) {
    return res.status(400).json({ message: "请输入账号和密码" });
  }

  const result = login(parsed.data);

  if (!result) {
    return res.status(401).json({ message: "账号或密码错误" });
  }

  return res.json(result);
});

router.get("/me", requireAuth, (req, res) => {
  const categories = readCategories().filter((entry) => entry.ownerUserIds.includes(req.user.id));

  return res.json({
    id: req.user.id,
    username: req.user.username,
    displayName: req.user.displayName,
    role: req.user.role,
    categories
  });
});

export default router;
