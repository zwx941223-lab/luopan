import { readUserById } from "../data/store.js";
import { verifyToken } from "../utils/auth.js";
import { config } from "../config.js";

function getBearerToken(headerValue = "") {
  const [scheme, token] = headerValue.split(" ");
  return scheme === "Bearer" ? token : null;
}

export function requireAuth(req, res, next) {
  try {
    const token = getBearerToken(req.headers.authorization);

    if (!token) {
      return res.status(401).json({ message: "缺少登录凭证" });
    }

    const payload = verifyToken(token);
    const user = readUserById(payload.sub);

    if (!user) {
      return res.status(401).json({ message: "账号不存在" });
    }

    req.user = user;
    next();
  } catch (error) {
    return res.status(401).json({ message: "登录已失效" });
  }
}

export function requireExtensionToken(req, res, next) {
  const token = req.headers["x-extension-token"];

  if (token !== config.extensionApiToken) {
    return res.status(401).json({ message: "扩展令牌无效" });
  }

  next();
}
