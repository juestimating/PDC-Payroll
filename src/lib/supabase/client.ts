// =============================================================================
// Browser Supabase client — SAFE for the client bundle (public anon key only).
// Uses @supabase/ssr's createBrowserClient so the session lives in cookies that
// the server client + middleware can read. Every read/write is RLS-gated.
// =============================================================================
import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
// Prefer the integration's publishable key; fall back to the classic anon key.
const anonKey =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

let browserClient: SupabaseClient | null = null;

/** True when Supabase env is configured (else the app runs in demo/mock mode). */
export function hasSupabaseBrowserEnv(): boolean {
  return Boolean(url && anonKey);
}

/** Singleton browser client (anon key, cookie session, RLS-gated). */
export function getSupabaseBrowser(): SupabaseClient {
  if (!url || !anonKey) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY. See .env.example.",
    );
  }
  if (!browserClient) {
    browserClient = createBrowserClient(url, anonKey);
  }
  return browserClient;
}
