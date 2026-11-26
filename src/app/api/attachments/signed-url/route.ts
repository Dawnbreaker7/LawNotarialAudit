import { NextResponse } from "next/server";
import { isSessionApproved, getValidSession } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";

const BUCKET_NAME = "notarial-attachments";
const SIGNED_URL_EXPIRES_IN_SECONDS = 900; // 15 minutes

export const preferredRegion = "sin1";

export async function POST(request: Request) {
  try {
    const valid = await getValidSession({ touchLastSeen: true });

    if (!valid) {
      return NextResponse.json(
        { error: "Authentication required." },
        { status: 401 }
      );
    }

    if (!isSessionApproved(valid)) {
      return NextResponse.json(
        { error: "Device approval is required to view attachments." },
        { status: 403 }
      );
    }

    if (valid.branch.role !== "owner" && valid.branch.role !== "branch") {
      return NextResponse.json(
        { error: "Forbidden." },
        { status: 403 }
      );
    }

    const body = (await request.json().catch(() => null)) as {
      path?: unknown;
    } | null;

    const path = typeof body?.path === "string" ? body.path.trim() : "";

    if (
      !path ||
      path.includes("..") ||
      path.includes("\\") ||
      path.startsWith("/")
    ) {
      return NextResponse.json(
        { error: "Invalid attachment path." },
        { status: 400 }
      );
    }

    if (valid.branch.role === "branch") {
      const branchPrefix = `${valid.branch.branch_code}/`;
      if (!path.startsWith(branchPrefix)) {
        return NextResponse.json(
          { error: "Access denied to attachment from another branch." },
          { status: 403 }
        );
      }
    }

    const supabase = createAdminClient();
    const { data, error } = await supabase.storage
      .from(BUCKET_NAME)
      .createSignedUrl(path, SIGNED_URL_EXPIRES_IN_SECONDS);

    if (error || !data?.signedUrl) {
      return NextResponse.json(
        { error: error?.message ?? "Unable to generate signed attachment URL." },
        { status: 404 }
      );
    }

    return NextResponse.json({ url: data.signedUrl });
  } catch (error) {
    console.error("Signed URL error:", error);
    return NextResponse.json(
      { error: "Unable to load attachment." },
      { status: 500 }
    );
  }
}
