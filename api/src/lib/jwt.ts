import jwt from "jsonwebtoken";
import { env } from "./env.js";
import type { Role } from "@prisma/client";

export type JwtPayload = {
  sub: string;
  email: string;
  role: Role;
};

export function signToken(payload: JwtPayload) {
  return jwt.sign(payload, env.jwtSecret, { expiresIn: env.jwtExpiresIn as jwt.SignOptions["expiresIn"] });
}

export function verifyToken(token: string): JwtPayload {
  return jwt.verify(token, env.jwtSecret) as JwtPayload;
}
