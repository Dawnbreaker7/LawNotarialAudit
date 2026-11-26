import { NextResponse } from "next/server";
import {
  getDefaultRedirect,
  getValidSession,
  isSessionApproved,
} from "@/lib/auth/session";

export const preferredRegion = "sin1";

export async function GET() {
  const valid = await getValidSession({ touchLastSeen: false });

  if (!valid) {
    const response = NextResponse.json({
      active: false,
      isApproved: false,
      role: null,
      redirectTo: "/login?reason=revoked",
    });
    response.cookies.set("session_token", "", {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 0,
    });
    return response;
  }

  const isApproved = isSessionApproved(valid);

  return NextResponse.json({
    active: true,
    isApproved,
    role: valid.branch.role,
    redirectTo: getDefaultRedirect(valid.branch.role, isApproved),
  });
}
