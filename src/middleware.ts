import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

const SESSION_COOKIE_NAME = "session_token";

async function sha256Hex(value: string): Promise<string> {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function redirectClearingSession(
  request: NextRequest,
  destination: string
): NextResponse {
  const response = NextResponse.redirect(new URL(destination, request.url));
  response.cookies.set(SESSION_COOKIE_NAME, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });
  return response;
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const rawSessionToken = request.cookies.get(SESSION_COOKIE_NAME)?.value;

  if (!rawSessionToken) {
    if (pathname === "/login") {
      return NextResponse.next();
    }
    return NextResponse.redirect(new URL("/login", request.url));
  }

  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseSecretKey = process.env.SUPABASE_SECRET_KEY;

  if (!supabaseUrl || !supabaseSecretKey) {
    if (pathname === "/login") {
      return NextResponse.next();
    }
    return NextResponse.redirect(new URL("/login", request.url));
  }

  const supabase = createClient<Database>(supabaseUrl, supabaseSecretKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  const tokenHash = await sha256Hex(rawSessionToken);

  const { data: sessionRow } = await supabase
    .from("device_sessions")
    .select("id, branch_id, device_id")
    .eq("session_token_hash", tokenHash)
    .eq("is_active", true)
    .is("revoked_at", null)
    .maybeSingle();

  if (!sessionRow) {
    if (pathname === "/login") {
      const response = NextResponse.next();
      response.cookies.set(SESSION_COOKIE_NAME, "", {
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        path: "/",
        maxAge: 0,
      });
      return response;
    }
    return redirectClearingSession(request, "/login?reason=revoked");
  }

  const [{ data: branchRow }, deviceResult] = await Promise.all([
    supabase
      .from("branches")
      .select("role, is_dev")
      .eq("id", sessionRow.branch_id)
      .maybeSingle(),
    sessionRow.device_id
      ? supabase
          .from("authorized_devices")
          .select("is_approved")
          .eq("id", sessionRow.device_id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  if (!branchRow) {
    return redirectClearingSession(request, "/login?reason=revoked");
  }

  const role = branchRow.role;
  const isDev = Boolean(branchRow.is_dev);
  const isApproved =
    role === "owner" || Boolean(deviceResult.data?.is_approved);
  const approvedHome = role === "owner" ? "/owner/dashboard" : "/branch/register";

  if (!isApproved) {
    if (pathname === "/pending-approval") {
      return NextResponse.next();
    }
    return NextResponse.redirect(new URL("/pending-approval", request.url));
  }

  if (
    pathname === "/" ||
    pathname === "/login" ||
    pathname === "/pending-approval"
  ) {
    return NextResponse.redirect(new URL(approvedHome, request.url));
  }

  if (pathname.startsWith("/owner") && role !== "owner") {
    return NextResponse.redirect(new URL("/branch/register", request.url));
  }

  if (pathname.startsWith("/branch") && role !== "branch" && !isDev) {
    return NextResponse.redirect(new URL("/owner/dashboard", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/",
    "/login",
    "/pending-approval",
    "/owner/:path*",
    "/branch/:path*",
  ],
};
