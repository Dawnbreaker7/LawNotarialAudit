import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { canAccessBranchPortal, getValidSession } from "@/lib/auth/session";
import { getActiveBranchBook } from "@/lib/branch/register";
import { createAdminClient } from "@/lib/supabase/admin";
import type { EntryAttachment } from "@/types/database";

const BUCKET_NAME = "notarial-attachments";
const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10MB

export const preferredRegion = "sin1";
const ALLOWED_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/pdf",
]);

function sanitizeFileName(rawName: string): string {
  const baseName = rawName.split(/[\\/]/).pop() ?? "attachment";
  const cleaned = baseName
    .replace(/[^a-zA-Z0-9._-]/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+/, "")
    .slice(0, 100);
  return cleaned || "attachment";
}

export async function POST(request: Request) {
  try {
    const valid = await getValidSession({ touchLastSeen: true });

    if (!valid) {
      return NextResponse.json(
        { error: "Authentication required." },
        { status: 401 }
      );
    }

    if (!canAccessBranchPortal(valid)) {
      return NextResponse.json(
        {
          error:
            "Only approved branches or DEV sandbox sessions can upload entry attachments.",
        },
        { status: 403 }
      );
    }

    const activeBook = await getActiveBranchBook(valid.branch.id);
    if (!activeBook) {
      return NextResponse.json(
        { error: "No active notarial book found for this branch." },
        { status: 400 }
      );
    }

    const formData = await request.formData().catch(() => null);
    if (!formData) {
      return NextResponse.json(
        { error: "Invalid multipart form data." },
        { status: 400 }
      );
    }

    const rawEntryNumber = formData.get("entry_number");
    const entryNumber = Number(rawEntryNumber);
    if (
      !Number.isFinite(entryNumber) ||
      !Number.isInteger(entryNumber) ||
      entryNumber < 1
    ) {
      return NextResponse.json(
        { error: "A valid positive entry_number is required for upload." },
        { status: 400 }
      );
    }

    const rawFiles = [
      ...formData.getAll("files"),
      ...formData.getAll("file"),
    ].filter((item): item is File => item instanceof File);

    if (rawFiles.length === 0) {
      return NextResponse.json(
        { error: "Please attach at least one file." },
        { status: 400 }
      );
    }

    for (const file of rawFiles) {
      if (!ALLOWED_MIME_TYPES.has(file.type)) {
        return NextResponse.json(
          {
            error: `Unsupported file type for "${file.name}". Allowed formats: JPG, PNG, WebP, or PDF.`,
          },
          { status: 400 }
        );
      }
      if (file.size <= 0 || file.size > MAX_FILE_SIZE_BYTES) {
        return NextResponse.json(
          {
            error: `File "${file.name}" must be between 1 byte and 10 MB.`,
          },
          { status: 400 }
        );
      }
    }

    const supabase = createAdminClient();
    const uploadedAttachments: EntryAttachment[] = [];
    const uploadedPaths: string[] = [];

    for (const file of rawFiles) {
      const attachmentId = crypto.randomUUID();
      const safeName = sanitizeFileName(file.name);
      const storagePath = `${valid.branch.branch_code}/${activeBook.id}/entry-${entryNumber}/${attachmentId}-${safeName}`;
      const arrayBuffer = await file.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      const { error: uploadError } = await supabase.storage
        .from(BUCKET_NAME)
        .upload(storagePath, buffer, {
          contentType: file.type,
          upsert: false,
        });

      if (uploadError) {
        if (uploadedPaths.length > 0) {
          await supabase.storage.from(BUCKET_NAME).remove(uploadedPaths);
        }
        return NextResponse.json(
          {
            error: `Failed to upload "${file.name}": ${uploadError.message}`,
          },
          { status: 500 }
        );
      }

      uploadedPaths.push(storagePath);
      uploadedAttachments.push({
        id: attachmentId,
        path: storagePath,
        file_name: file.name || safeName,
        mime_type: file.type,
        size: file.size,
        uploaded_at: new Date().toISOString(),
      });
    }

    return NextResponse.json(
      { attachments: uploadedAttachments },
      { status: 201 }
    );
  } catch (error) {
    console.error("Branch upload error:", error);
    return NextResponse.json(
      { error: "Unable to upload attachment files." },
      { status: 500 }
    );
  }
}
