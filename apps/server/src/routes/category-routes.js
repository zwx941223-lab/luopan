import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { getCategoriesForUser } from "../services/record-service.js";

const router = Router();

router.get("/", requireAuth, (req, res) => {
  return res.json(getCategoriesForUser(req.user));
});

export default router;
