import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

let browserClient: SupabaseClient<Database> | null = null;

/**
 * Returns a browser-safe Supabase client using the public URL and publishable key.
 */
export function createBrowserSupabaseClient(): SupabaseClient<Database> {
  if (browserClient) {
    return browserClient;
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabasePublishableKey =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!supabaseUrl || !supabasePublishableKey) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY environment variable."
    );
  }

  browserClient = createClient<Database>(supabaseUrl, supabasePublishableKey);
  return browserClient;
}
