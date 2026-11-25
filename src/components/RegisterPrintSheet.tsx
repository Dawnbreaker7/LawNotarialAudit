"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import type { NotarialBook, NotarialEntry } from "@/types/database";

export const PRINT_SHEET_WIDTH = 1150;
export const ENTRIES_PER_PAGE = 5;

function formatDateOnly(isoOrDate: string | null): string | null {
  if (!isoOrDate) return null;
  const parsed = new Date(isoOrDate);
  if (Number.isNaN(parsed.getTime())) return isoOrDate;
  return parsed.toLocaleDateString("en-PH", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function formatDateTime(iso: string): string {
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return iso;
  return parsed.toLocaleString("en-PH", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatFeeNumber(amount: number): string {
  const hasDecimals = Math.round(amount * 100) % 100 !== 0;
  return `₱${amount.toLocaleString("en-PH", {
    minimumFractionDigits: hasDecimals ? 2 : 0,
    maximumFractionDigits: 2,
  })}`;
}

interface ScaledPrintPreviewProps {
  fitToScreen: boolean;
  children: ReactNode;
}

/**
 * Scales a fixed 1150px-wide register sheet down proportionally on narrow
 * mobile/foldable cover screens while restoring full unscaled width on print.
 */
export function ScaledPrintPreview({
  fitToScreen,
  children,
}: ScaledPrintPreviewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const sheetRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState<number>(PRINT_SHEET_WIDTH);
  const [sheetHeight, setSheetHeight] = useState<number>(0);

  useEffect(() => {
    const containerEl = containerRef.current;
    const sheetEl = sheetRef.current;
    if (!containerEl || !sheetEl) return;

    const updateSizes = () => {
      setContainerWidth(containerEl.clientWidth);
      setSheetHeight(sheetEl.offsetHeight);
    };

    updateSizes();

    const observer = new ResizeObserver(() => {
      updateSizes();
    });
    observer.observe(containerEl);
    observer.observe(sheetEl);

    return () => observer.disconnect();
  }, []);

  const scale = fitToScreen
    ? Math.min(1, Math.max(0.2, containerWidth / PRINT_SHEET_WIDTH))
    : 1;

  const wrapperHeight =
    fitToScreen && scale < 1 && sheetHeight > 0
      ? Math.ceil(sheetHeight * scale)
      : undefined;

  return (
    <div
      ref={containerRef}
      style={{ height: wrapperHeight }}
      className={`print-sheet mx-auto mb-6 w-full max-w-[1150px] last:mb-0 print:!mb-0 print:!h-auto print:!w-full print:!max-w-none print:!overflow-visible ${
        fitToScreen && scale < 1
          ? "overflow-hidden"
          : "overflow-x-auto"
      }`}
    >
      <div
        ref={sheetRef}
        style={{
          width: PRINT_SHEET_WIDTH,
          transform: fitToScreen && scale < 1 ? `scale(${scale})` : undefined,
          transformOrigin: "top left",
        }}
        className="print:!w-full print:!transform-none"
      >
        {children}
      </div>
    </div>
  );
}

interface RegisterPrintSheetProps {
  branchName: string;
  book: Pick<
    NotarialBook,
    | "notary_name"
    | "jurisdiction"
    | "appointment_date"
    | "commission_expiry"
    | "book_no"
    | "series_year"
  > | null;
  pageNo: number;
  entries: NotarialEntry[];
}

export default function RegisterPrintSheet({
  branchName,
  book,
  pageNo,
  entries,
}: RegisterPrintSheetProps) {
  const formattedAppointmentDate = formatDateOnly(
    book?.appointment_date ?? null
  );
  const formattedExpiryDate = formatDateOnly(
    book?.commission_expiry ?? null
  );

  const rows: Array<NotarialEntry | null> = Array.from(
    { length: ENTRIES_PER_PAGE },
    (_, idx) => entries[idx] ?? null
  );

  return (
    <div
      className="w-[1150px] border border-slate-200 bg-white p-8 text-black shadow-sm print:w-full print:border-none print:p-0 print:shadow-none"
      style={{ fontFamily: "'Times New Roman', Times, serif" }}
    >
      {/* Exact Top Header */}
      <div className="mb-1.5 flex w-full items-end text-[11px] leading-snug text-black">
        {/* Left Header Block (41.5%, flush with left edge of grid) */}
        <div className="w-[41.5%]">
          <div className="font-bold italic">
            NOTARIAL REGISTER OF Mr.{" "}
            <span className="not-italic uppercase">
              {book?.notary_name ?? ""}
            </span>
          </div>
          <div>
            <em>Under appointment made on the </em>
            {formattedAppointmentDate ? (
              <u>{formattedAppointmentDate}</u>
            ) : (
              <span className="inline-block w-48 border-b border-black" />
            )}
          </div>
        </div>

        {/* Center-Right Header Block (34%, aligned at pl-4) */}
        <div className="w-[34%] pl-4">
          <div className="text-[10.5px] uppercase italic tracking-wide">
            JUDICIAL FORM NO. 143 AS AMENDED
          </div>
          <div>
            <em>of </em>
            <strong>{book?.jurisdiction ?? ""}</strong>
            <em> for the year </em>
            <u>
              <strong>{book?.series_year ?? ""}</strong>
            </u>
          </div>
          <div>
            <em>And Expiring </em>
            <strong>
              <em>{formattedExpiryDate || "December 31, 2026"}</em>
            </strong>
          </div>
        </div>

        {/* Far-Right Spacer (24.5%) */}
        <div className="w-[24.5%] self-start text-right text-[9px] text-gray-500 print:text-black">
          Branch: {branchName}
        </div>
      </div>

      {/* Exact 9-Column Table */}
      <table className="w-full table-fixed border-collapse border border-black text-[10.5px]">
        <thead>
          <tr className="bg-[#dcdcdc] text-center text-[9px] font-bold uppercase leading-tight print:bg-[#dcdcdc]">
            <th className="w-[5.5%] border border-black px-1 py-1.5 align-middle">
              ENTRY NUMBER
            </th>
            <th className="w-[17.5%] border border-black px-1 py-1.5 align-middle">
              TITLE/DESCRIPTION OF INSTRUMENT
            </th>
            <th className="w-[18.5%] border border-black px-1 py-1.5 align-middle">
              NAMES &amp; ADDRESSES OF PARTIES
            </th>
            <th className="w-[8.5%] border border-black px-1 py-1.5 align-middle">
              NAMES &amp; ADDRESSES OF WITNESSES
            </th>
            <th className="w-[8.5%] border border-black px-1 py-1.5 align-middle">
              COMPETENT EVIDENCE OF IDENTITY
            </th>
            <th className="w-[11%] border border-black px-1 py-1.5 align-middle">
              DATE &amp; TIME OF NOTARIZATION
            </th>
            <th className="w-[8.5%] border border-black px-1 py-1.5 align-middle">
              TYPE OF NOTARIAL ACT
            </th>
            <th className="w-[8.5%] border border-black px-1 py-1.5 align-middle">
              FEES &amp; O.R. NO.
            </th>
            <th className="w-[13.5%] border border-black px-1 py-1.5 align-middle">
              OTHER PLACE OF NOTARIZATION OTHER THAN OFFICE OF NOTARY PUBLIC
              AND/OR REMARKS
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((entry, idx) => (
            <tr
              key={entry ? entry.id : `empty-${pageNo}-${idx}`}
              className="h-[64px] align-top"
            >
              <td className="border border-black px-1 py-1 text-center font-bold">
                <div className="min-h-[56px]">
                  {entry ? entry.entry_number : ""}
                </div>
              </td>
              <td className="break-words border border-black px-1.5 py-1">
                {entry ? entry.instrument_title : ""}
              </td>
              <td className="whitespace-pre-line break-words border border-black px-1.5 py-1">
                {entry ? entry.parties : ""}
              </td>
              <td className="whitespace-pre-line break-words border border-black px-1.5 py-1">
                {entry?.secondary_parties ?? ""}
              </td>
              <td className="break-words border border-black px-1.5 py-1">
                {entry?.competent_evidence_id ?? ""}
              </td>
              <td className="break-words border border-black px-1.5 py-1 text-center">
                {entry ? formatDateTime(entry.notarized_at) : ""}
              </td>
              <td className="break-words border border-black px-1 py-1 text-center">
                {entry ? entry.notarial_act_type : ""}
              </td>
              <td className="break-words border border-black px-1.5 py-1 text-center">
                {entry ? (
                  <div className="space-y-0.5 leading-tight">
                    <div>
                      {formatFeeNumber(entry.amount_paid)}
                      {entry.payment_type === "partial" ? " (Partial)" : ""}
                    </div>
                    {entry.acknowledgement_receipt && (
                      <div className="text-[9.5px]">
                        AR: {entry.acknowledgement_receipt}
                      </div>
                    )}
                  </div>
                ) : (
                  ""
                )}
              </td>
              <td className="break-words border border-black px-1.5 py-1">
                {entry?.place_and_remarks ?? ""}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Exact Bottom Footer */}
      <div className="mt-2 flex w-full items-start text-[11px] leading-snug text-black">
        {/* Left Footer Block (50%, flush with left edge of grid) */}
        <div className="w-[50%]">
          <div>Nature of Notarial act whether oath or acknowledgment.</div>
          <div className="mt-3 text-[10.5px] font-bold leading-tight">
            <div>NOTARY PUBLIC</div>
            <div>
              PAGE NO.: <u>{pageNo}</u>
            </div>
            <div>
              BOOK NO. <u>{book?.book_no ?? "___"}</u>
            </div>
            <div>
              SERIES OF: <u>{book?.series_year ?? "____"}</u>
            </div>
          </div>
        </div>

        {/* Right Certification Block (50%) */}
        <div className="w-[50%] pr-4">
          <div className="inline-block max-w-full">
            <div>
              I HEREBY CERTIFY that during the past week, instrument were
              executed, sworn to, and acknowledged before me.
            </div>
            <div className="mt-12 w-full border-b border-black" />
          </div>
        </div>
      </div>
    </div>
  );
}
