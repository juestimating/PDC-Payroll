// =============================================================================
// Server-only Supabase admin client. The "server-only" import below makes the
// build FAIL if this file is ever imported into a client component — a hard
// guardrail so the service_role key can never reach the browser bundle.
//
// service_role BYPASSES RLS. Use only in server actions / route handlers /
// migrations, and always re-check authorization in your own server code.
// =============================================================================
import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
// Prefer the classic service_role key; fall back to the integration's secret key.
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SECRET_KEY;

/** Privileged server client. Never expose results without an auth check. */
export function getSupabaseAdmin(): SupabaseClient {
  if (!url || !serviceRoleKey) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY (server-only). See .env.example.",
    );
  }
  return createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
