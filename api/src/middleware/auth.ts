import type { Request, Response, NextFunction } from "express";
import { verifyToken, type JwtPayload } from "../lib/jwt.js";
import type { Role } from "@prisma/client";

export type AuthedRequest = Request & { user?: JwtPayload };

export function requireAuth(...roles: Role[]) {
  return (req: AuthedRequest, res: Response, next: NextFunction) => {
    const header = req.headers.authorization;
    if (!header?.startsWith("Bearer ")) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    try {
      const payload = verifyToken(header.slice(7));
      if (roles.length && !roles.includes(payload.role)) {
        return res.status(403).json({ error: "Forbidden" });
      }
      req.user = payload;
      next();
    } catch {
      return res.status(401).json({ error: "Invalid token" });
    }
  };
}
