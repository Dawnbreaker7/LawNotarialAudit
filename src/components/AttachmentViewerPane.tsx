"use client";

import { useEffect, useState } from "react";
import {
  ExternalLink,
  FileText,
  Loader2,
  Paperclip,
  RefreshCw,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import type { EntryAttachment } from "@/types/database";

interface AttachmentViewerPaneProps {
  attachments: EntryAttachment[];
  emptyMessage?: string;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export default function AttachmentViewerPane({
  attachments,
  emptyMessage = "No scanned instruments or IDs were attached to this entry.",
}: AttachmentViewerPaneProps) {
  const [selectedId, setSelectedId] = useState<string>(
    attachments[0]?.id ?? ""
  );
  const [signedUrls, setSignedUrls] = useState<Record<string, string>>({});
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [zoomed, setZoomed] = useState(false);

  const activeAttachment =
    attachments.find((a) => a.id === selectedId) ?? attachments[0] ?? null;

  useEffect(() => {
    setSelectedId(attachments[0]?.id ?? "");
    setZoomed(false);
    setErrorMsg(null);
  }, [attachments]);

  async function loadSignedUrl(attachment: EntryAttachment) {
    setLoadingId(attachment.id);
    setErrorMsg(null);
    try {
      const res = await fetch("/api/attachments/signed-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path: attachment.path }),
      });
      const payload = (await res.json().catch(() => ({}))) as {
        url?: string;
        error?: string;
      };
      if (!res.ok || !payload.url) {
        setErrorMsg(payload.error ?? "Unable to load signed file URL.");
        return;
      }
      setSignedUrls((prev) => ({
        ...prev,
        [attachment.id]: payload.url!,
      }));
    } catch {
      setErrorMsg("Network error while loading attachment.");
    } finally {
      setLoadingId(null);
    }
  }

  useEffect(() => {
    if (!activeAttachment) return;
    if (signedUrls[activeAttachment.id]) return;
    void loadSignedUrl(activeAttachment);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeAttachment?.id, activeAttachment?.path]);

  if (attachments.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-12 text-center">
        <Paperclip className="mb-2 h-7 w-7 text-slate-400" />
        <p className="text-sm font-medium text-slate-700">{emptyMessage}</p>
      </div>
    );
  }

  const activeUrl = activeAttachment ? signedUrls[activeAttachment.id] : null;
  const isPdf = activeAttachment?.mime_type === "application/pdf";
  const isLoading = loadingId === activeAttachment?.id && !activeUrl;

  return (
    <div className="space-y-3">
      {/* File Switcher */}
      <div className="flex flex-wrap gap-2">
        {attachments.map((file, idx) => {
          const isActive = file.id === activeAttachment?.id;
          return (
            <button
              key={file.id}
              type="button"
              onClick={() => {
                setSelectedId(file.id);
                setZoomed(false);
              }}
              className={`inline-flex min-h-[40px] max-w-full items-center gap-2 rounded-lg border px-3 py-1.5 text-left text-xs font-medium transition ${
                isActive
                  ? "border-slate-900 bg-slate-900 text-white"
                  : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
              }`}
            >
              <FileText className="h-3.5 w-3.5 shrink-0" />
              <span className="max-w-[170px] truncate">
                {idx + 1}. {file.file_name}
              </span>
              <span
                className={`text-[10px] ${
                  isActive ? "text-slate-300" : "text-slate-400"
                }`}
              >
                {formatFileSize(file.size)}
              </span>
            </button>
          );
        })}
      </div>

      {/* Controls */}
      {activeAttachment && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs">
          <span className="truncate font-medium text-slate-700">
            {activeAttachment.file_name}
          </span>
          <div className="flex flex-wrap items-center gap-2">
            {!isPdf && activeUrl && (
              <button
                type="button"
                onClick={() => setZoomed((z) => !z)}
                className="inline-flex min-h-[36px] items-center gap-1 rounded-md border border-slate-300 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100"
              >
                {zoomed ? (
                  <>
                    <ZoomOut className="h-3.5 w-3.5" />
                    Fit View
                  </>
                ) : (
                  <>
                    <ZoomIn className="h-3.5 w-3.5" />
                    Zoom In
                  </>
                )}
              </button>
            )}
            {activeUrl && (
              <a
                href={activeUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex min-h-[36px] items-center gap-1 rounded-md border border-slate-300 bg-white px-2.5 py-1 text-xs font-medium text-slate-800 hover:bg-slate-100"
              >
                <ExternalLink className="h-3.5 w-3.5" />
                Open in New Tab
              </a>
            )}
          </div>
        </div>
      )}

      {/* Preview Area */}
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-slate-100">
        {isLoading ? (
          <div className="flex h-64 items-center justify-center gap-2 text-sm text-slate-600">
            <Loader2 className="h-5 w-5 animate-spin" />
            Loading secure file preview...
          </div>
        ) : errorMsg ? (
          <div className="flex h-64 flex-col items-center justify-center gap-3 px-4 text-center">
            <p className="text-sm text-red-700">{errorMsg}</p>
            {activeAttachment && (
              <button
                type="button"
                onClick={() => void loadSignedUrl(activeAttachment)}
                className="inline-flex min-h-[40px] items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-800 hover:bg-slate-50"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                Retry Preview
              </button>
            )}
          </div>
        ) : activeUrl && isPdf ? (
          <div className="space-y-2 bg-white p-2">
            <iframe
              src={activeUrl}
              title={activeAttachment?.file_name ?? "PDF Attachment"}
              className="h-[360px] w-full rounded-lg border border-slate-200 sm:h-[480px]"
            />
            <p className="px-1 text-[11px] text-slate-500">
              If the PDF preview does not display on mobile, tap{" "}
              <strong>Open in New Tab</strong> above.
            </p>
          </div>
        ) : activeUrl ? (
          <div className="max-h-[520px] overflow-auto p-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={activeUrl}
              alt={activeAttachment?.file_name ?? "Attachment preview"}
              onClick={() => setZoomed((z) => !z)}
              className={
                zoomed
                  ? "w-[175%] max-w-none cursor-zoom-out rounded border border-slate-200 bg-white"
                  : "mx-auto max-h-[480px] w-auto max-w-full cursor-zoom-in rounded border border-slate-200 bg-white object-contain"
              }
            />
          </div>
        ) : null}
      </div>
    </div>
  );
}
