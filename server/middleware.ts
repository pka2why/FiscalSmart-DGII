import type { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

export interface AuthUser {
  id: string;
  tenantId: string;
  email: string;
  name: string;
  role: string;
}

export interface AuthedRequest extends Request {
  user?: AuthUser;
}

const COOKIE_NAME = "fs_token";

export function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("JWT_SECRET is required in production");
    }
    return "dev-insecure-jwt-secret";
  }
  return secret;
}

export function signToken(user: AuthUser): string {
  return jwt.sign(
    {
      id: user.id,
      tenantId: user.tenantId,
      email: user.email,
      name: user.name,
      role: user.role,
    },
    getJwtSecret(),
    { expiresIn: "7d" }
  );
}

export function setAuthCookie(res: Response, token: string): void {
  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 7 * 24 * 60 * 60 * 1000,
    path: "/",
  });
}

export function clearAuthCookie(res: Response): void {
  // Attributes must match setAuthCookie or browsers keep the session cookie.
  res.clearCookie(COOKIE_NAME, {
    path: "/",
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    httpOnly: true,
  });
}

export function requireAuth(
  req: AuthedRequest,
  res: Response,
  next: NextFunction
): void {
  try {
    const token =
      req.cookies?.[COOKIE_NAME] ||
      (req.headers.authorization?.startsWith("Bearer ")
        ? req.headers.authorization.slice(7)
        : undefined);

    if (!token) {
      res.status(401).json({ error: "No autenticado" });
      return;
    }

    const payload = jwt.verify(token, getJwtSecret()) as AuthUser;
    req.user = {
      id: payload.id,
      tenantId: payload.tenantId,
      email: payload.email,
      name: payload.name,
      role: payload.role,
    };
    next();
  } catch {
    res.status(401).json({ error: "Sesión inválida o expirada" });
  }
}

export function requireAdminSecret(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const secret = process.env.ADMIN_SECRET;
  if (!secret) {
    res.status(503).json({ error: "ADMIN_SECRET no configurado" });
    return;
  }
  const header = req.headers["x-admin-secret"];
  if (header !== secret) {
    res.status(401).json({ error: "Admin secret inválido" });
    return;
  }
  next();
}

export { COOKIE_NAME };
