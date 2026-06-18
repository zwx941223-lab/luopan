import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { config } from "../config.js";

export function signUserToken(user) {
  return jwt.sign(
    {
      sub: user.id,
      username: user.username,
      role: user.role
    },
    config.jwtSecret,
    { expiresIn: "7d" }
  );
}

export function verifyPassword(password, passwordHash) {
  return bcrypt.compareSync(password, passwordHash);
}

export function verifyToken(token) {
  return jwt.verify(token, config.jwtSecret);
}
