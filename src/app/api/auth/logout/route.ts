import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  getAuthCookieOptions,
  hashToken,
  SESSION_COOKIE_NAME,
} from "@/lib/auth/crypto";

export async function POST(request: NextRequest) {
  const rawSessionToken = request.cookies.get(SESSION_COOKIE_NAME)?.value;

  if (rawSessionToken) {
    const tokenHash = hashToken(rawSessionToken);
    const supabase = createAdminClient();

    await supabase
      .from("device_sessions")
      .update({
        is_active: false,
        revoked_at: new Date().toISOString(),
        revoked_by: "SELF",
      })
      .eq("session_token_hash", tokenHash)
      .eq("is_active", true);
  }

  const wantsJson = request.headers
    .get("accept")
    ?.includes("application/json");

  const response = wantsJson
    ? NextResponse.json({ ok: true, redirectTo: "/login" })
    : NextResponse.redirect(new URL("/login", request.url), { status: 303 });

  // Clear session_token cookie while preserving device_token so the PC stays recognized.
  response.cookies.set(SESSION_COOKIE_NAME, "", getAuthCookieOptions(0));

  return response;
}
