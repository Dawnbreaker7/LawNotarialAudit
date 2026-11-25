import crypto from "node:crypto";
import bcrypt from "bcryptjs";
import type { BranchCode } from "@/types/database";

export const SESSION_COOKIE_NAME = "session_token";
export const DEVICE_COOKIE_NAME = "device_token";

export function getDeviceCookieName(branchCode: BranchCode): string {
  return `${DEVICE_COOKIE_NAME}_${branchCode.toLowerCase()}`;
}

export const DEVICE_COOKIE_MAX_AGE = 60 * 60 * 24 * 365; // 1 year
export const SESSION_COOKIE_MAX_AGE = 60 * 60 * 24 * 7; // 7 days

export function generateRandomToken(byteLength = 32): string {
  return crypto.randomBytes(byteLength).toString("hex");
}

export function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export async function verifyPassword(
  plainPassword: string,
  passwordHash: string
): Promise<boolean> {
  return bcrypt.compare(plainPassword, passwordHash);
}

export function getAuthCookieOptions(maxAge: number) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge,
  };
}
