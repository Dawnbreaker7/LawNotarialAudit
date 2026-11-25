import { UAParser } from "ua-parser-js";
import type { DeviceType } from "@/types/database";

export interface ParsedDeviceInfo {
  device_type: DeviceType;
  os_name: string;
  browser_name: string;
}

export function parseUserAgent(
  userAgentHeader: string | null | undefined
): ParsedDeviceInfo {
  const rawUa = userAgentHeader?.trim() ?? "";
  if (!rawUa) {
    return {
      device_type: "unknown",
      os_name: "Unknown OS",
      browser_name: "Unknown Browser",
    };
  }

  const parsed = new UAParser(rawUa).getResult();
  const rawDeviceType = parsed.device.type?.toLowerCase();

  let device_type: DeviceType = "unknown";
  if (rawDeviceType === "mobile" || rawDeviceType === "wearable") {
    device_type = "mobile";
  } else if (rawDeviceType === "tablet") {
    device_type = "tablet";
  } else if (!rawDeviceType && (parsed.browser.name || parsed.os.name)) {
    device_type = "desktop";
  }

  const os_name =
    [parsed.os.name, parsed.os.version].filter(Boolean).join(" ") ||
    "Unknown OS";
  const browserMajor = parsed.browser.version?.split(".")[0];
  const browser_name =
    [parsed.browser.name, browserMajor].filter(Boolean).join(" ") ||
    "Unknown Browser";

  return {
    device_type,
    os_name,
    browser_name,
  };
}

export function getClientIp(headers: Headers): string {
  const forwardedFor = headers.get("x-forwarded-for");
  if (forwardedFor) {
    const firstIp = forwardedFor.split(",")[0]?.trim();
    if (firstIp) {
      return firstIp;
    }
  }

  const realIp = headers.get("x-real-ip")?.trim();
  if (realIp) {
    return realIp;
  }

  return "unknown";
}
