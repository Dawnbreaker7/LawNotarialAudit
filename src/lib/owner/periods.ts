export type DashboardPeriod = "today" | "week" | "month" | "all";

const MANILA_OFFSET_MS = 8 * 60 * 60 * 1000;

export function normalizeDashboardPeriod(
  raw?: string | null
): DashboardPeriod {
  const normalized = raw?.trim().toLowerCase();
  if (
    normalized === "today" ||
    normalized === "week" ||
    normalized === "month" ||
    normalized === "all"
  ) {
    return normalized;
  }
  return "all";
}

function formatYmdFromManilaMs(manilaMs: number): string {
  const d = new Date(manilaMs);
  const year = d.getUTCFullYear();
  const month = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatReadableDateFromYmd(ymd: string): string {
  const [y, m, d] = ymd.split("-").map(Number);
  if (!y || !m || !d) return ymd;
  const dt = new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
  return dt.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

export function getManilaBoundaries(now = new Date()) {
  const manilaNow = new Date(now.getTime() + MANILA_OFFSET_MS);
  const year = manilaNow.getUTCFullYear();
  const month = manilaNow.getUTCMonth();
  const day = manilaNow.getUTCDate();
  const dayOfWeek = manilaNow.getUTCDay();
  const daysSinceMonday = (dayOfWeek + 6) % 7;

  const todayStartMs = Date.UTC(year, month, day) - MANILA_OFFSET_MS;
  const weekStartMs = todayStartMs - daysSinceMonday * 86_400_000;
  const monthStartMs = Date.UTC(year, month, 1) - MANILA_OFFSET_MS;

  return { todayStartMs, weekStartMs, monthStartMs };
}

export function getManilaPeriodDateRange(
  period: DashboardPeriod,
  now = new Date()
): {
  period: DashboardPeriod;
  title: string;
  date_from: string;
  date_to: string;
  subtitle: string;
} {
  if (period === "all") {
    return {
      period: "all",
      title: "All-Time — Collection & Entry Summary",
      date_from: "",
      date_to: "",
      subtitle: "All Recorded Dates",
    };
  }

  const { todayStartMs, weekStartMs, monthStartMs } = getManilaBoundaries(now);
  const todayYmd = formatYmdFromManilaMs(todayStartMs + MANILA_OFFSET_MS);

  if (period === "today") {
    return {
      period: "today",
      title: "Today — Collection & Entry Summary",
      date_from: todayYmd,
      date_to: todayYmd,
      subtitle: formatReadableDateFromYmd(todayYmd),
    };
  }

  if (period === "week") {
    const startYmd = formatYmdFromManilaMs(weekStartMs + MANILA_OFFSET_MS);
    return {
      period: "week",
      title: "This Week — Collection & Entry Summary",
      date_from: startYmd,
      date_to: todayYmd,
      subtitle:
        startYmd === todayYmd
          ? formatReadableDateFromYmd(todayYmd)
          : `${formatReadableDateFromYmd(startYmd)} – ${formatReadableDateFromYmd(todayYmd)}`,
    };
  }

  const monthStartYmd = formatYmdFromManilaMs(monthStartMs + MANILA_OFFSET_MS);
  return {
    period: "month",
    title: "This Month — Collection & Entry Summary",
    date_from: monthStartYmd,
    date_to: todayYmd,
    subtitle:
      monthStartYmd === todayYmd
        ? formatReadableDateFromYmd(todayYmd)
        : `${formatReadableDateFromYmd(monthStartYmd)} – ${formatReadableDateFromYmd(todayYmd)}`,
  };
}
