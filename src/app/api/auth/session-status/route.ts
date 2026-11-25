import { NextResponse } from "next/server";
import {
  getDefaultRedirect,
  getValidSession,
  isSessionApproved,
} from "@/lib/auth/session";

export async function GET() {
  const valid = await getValidSession({ touchLastSeen: false });

  if (!valid) {
    return NextResponse.json({
      active: false,
      isApproved: false,
      role: null,
      redirectTo: "/login?reason=revoked",
    });
  }

  const isApproved = isSessionApproved(valid);

  return NextResponse.json({
    active: true,
    isApproved,
    role: valid.branch.role,
    redirectTo: getDefaultRedirect(valid.branch.role, isApproved),
  });
}
