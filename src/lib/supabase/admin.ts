import {
  createClient,
  type SupabaseClient,
  type SupabaseClientOptions,
} from "@supabase/supabase-js";
import WebSocket from "ws";
import type { Database } from "@/types/database";

type RealtimeTransport = NonNullable<
  NonNullable<SupabaseClientOptions<"public">["realtime"]>["transport"]
>;

/**
 * Creates a server-only Supabase admin client using the secret key.
 * Never import or invoke this in browser/client components.
 */
export function createAdminClient(): SupabaseClient<Database> {
  if (typeof window !== "undefined") {
    throw new Error(
      "createAdminClient() is server-only and cannot be used in the browser."
    );
  }

  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseSecretKey = process.env.SUPABASE_SECRET_KEY;

  if (!supabaseUrl || !supabaseSecretKey) {
    throw new Error(
      "Missing SUPABASE_URL or SUPABASE_SECRET_KEY environment variable."
    );
  }

  return createClient<Database>(supabaseUrl, supabaseSecretKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
    ...(typeof globalThis.WebSocket === "undefined"
      ? {
          realtime: {
            transport: WebSocket as unknown as RealtimeTransport,
          },
        }
      : {}),
  });
}
