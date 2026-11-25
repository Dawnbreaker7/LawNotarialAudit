"use client";

import { useEffect, useRef } from "react";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";

interface SessionWatcherProps {
  sessionId: string;
  deviceId: string | null;
  isApproved: boolean;
}

const POLL_INTERVAL_MS = 5000;

export default function SessionWatcher({
  sessionId,
  deviceId,
  isApproved,
}: SessionWatcherProps) {
  const handlingRevokeRef = useRef(false);
  const handlingRedirectRef = useRef(false);

  useEffect(() => {
    let active = true;

    async function handleRevoked() {
      if (handlingRevokeRef.current || !active) {
        return;
      }
      handlingRevokeRef.current = true;

      try {
        await fetch("/api/auth/logout", {
          method: "POST",
          headers: { Accept: "application/json" },
        });
      } catch {
        // Proceed to login redirect even if logout request fails.
      }

      window.location.assign("/login?reason=revoked");
    }

    async function syncSessionStatus() {
      if (!active || handlingRevokeRef.current || handlingRedirectRef.current) {
        return;
      }

      try {
        const res = await fetch("/api/auth/session-status", {
          cache: "no-store",
        });
        if (!res.ok) {
          return;
        }

        const data = (await res.json()) as {
          active: boolean;
          isApproved: boolean;
          redirectTo: string;
        };

        if (!data.active) {
          await handleRevoked();
          return;
        }

        if (!isApproved && data.isApproved) {
          handlingRedirectRef.current = true;
          window.location.assign(data.redirectTo);
          return;
        }

        if (isApproved && !data.isApproved) {
          handlingRedirectRef.current = true;
          window.location.assign("/pending-approval");
        }
      } catch {
        // Ignore transient network errors; next poll will retry.
      }
    }

    const supabase = createBrowserSupabaseClient();

    const sessionChannel = supabase
      .channel(`session:${sessionId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "device_sessions",
          filter: `id=eq.${sessionId}`,
        },
        (payload) => {
          const nextRow = payload.new as {
            is_active?: boolean;
            revoked_at?: string | null;
          };
          if (nextRow.is_active === false || nextRow.revoked_at) {
            void handleRevoked();
          }
        }
      )
      .on("broadcast", { event: "session_revoked" }, () => {
        void handleRevoked();
      })
      .subscribe();

    const deviceChannel = deviceId
      ? supabase
          .channel(`device:${deviceId}`)
          .on(
            "postgres_changes",
            {
              event: "UPDATE",
              schema: "public",
              table: "authorized_devices",
              filter: `id=eq.${deviceId}`,
            },
            (payload) => {
              const nextDevice = payload.new as { is_approved?: boolean };
              if (
                (!isApproved && nextDevice.is_approved === true) ||
                (isApproved && nextDevice.is_approved === false)
              ) {
                void syncSessionStatus();
              }
            }
          )
          .on("broadcast", { event: "device_updated" }, () => {
            void syncSessionStatus();
          })
          .subscribe()
      : null;

    const pollTimer = window.setInterval(() => {
      void syncSessionStatus();
    }, POLL_INTERVAL_MS);

    return () => {
      active = false;
      window.clearInterval(pollTimer);
      void supabase.removeChannel(sessionChannel);
      if (deviceChannel) {
        void supabase.removeChannel(deviceChannel);
      }
    };
  }, [sessionId, deviceId, isApproved]);

  return null;
}
