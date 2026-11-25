import { NextResponse } from "next/server";
import { getValidSession, type ValidSession } from "@/lib/auth/session";

export type OwnerAuthResult =
  | { valid: ValidSession; error?: undefined }
  | { valid?: undefined; error: NextResponse };

export async function requireApprovedOwnerApi(): Promise<OwnerAuthResult> {
  const valid = await getValidSession();
  if (!valid) {
    return {
      error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }
  if (valid.branch.role !== "owner") {
    return {
      error: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
    };
  }
  return { valid };
}
