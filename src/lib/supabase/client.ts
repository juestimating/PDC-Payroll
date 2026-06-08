// =============================================================================
// Browser Supabase client — SAFE for the client bundle.
// Uses ONLY the public anon key. Every read/write is gated by RLS policies.
//
// NOTE: This is wiring scaffolding for the later logic phase. The current
// front-end runs on mock data (see src/lib/data). Swap the data adapters to
// call this client once the schema + RLS are in place.
// =============================================================================
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

let browserClient: SupabaseClient | null = null;

/** Singleton browser client (anon key, RLS-gated). */
export function getSupabaseBrowser(): SupabaseClient {
  if (!url || !anonKey) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY. See .env.example.",
    );
  }
  if (!browserClient) {
    browserClient = createClient(url, anonKey);
  }
  return browserClient;
}
