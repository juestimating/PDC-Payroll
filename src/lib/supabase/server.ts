// =============================================================================
// Server-side Supabase client (cookie-based session via @supabase/ssr). Used by
// server components, server actions, and route handlers so every query runs as
// the LOGGED-IN user and RLS applies with their role. NEVER the service role.
// =============================================================================
import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { Role } from "@/lib/data";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

/** True when Supabase env is configured. When false, the app runs in demo/mock mode. */
export function hasSupabaseEnv(): boolean {
  return Boolean(url && anonKey);
}

/** Per-request server client bound to the caller's auth cookies. */
export async function createSupabaseServerClient() {
  const cookieStore = await cookies();
  return createServerClient(url!, anonKey!, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        // In Server Components cookie writes throw; middleware refreshes the
        // session, so swallowing here is safe.
        try {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          /* no-op in RSC */
        }
      },
    },
  });
}

export interface SessionProfile {
  userId: string;
  email: string;
  role: Role;
  fullName: string;
  employeeId: string | null;
  entityScope: string | null;
}

/** The authenticated user + their profile, or null if unauthenticated / no env. */
export async function getSessionProfile(): Promise<SessionProfile | null> {
  if (!hasSupabaseEnv()) return null;
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: profile } = await supabase
    .from("profiles")
    .select("role, full_name, employee_id, entity_scope, active")
    .eq("id", user.id)
    .single();
  return {
    userId: user.id,
    email: user.email ?? "",
    role: (profile?.role as Role) ?? "hr",
    fullName: profile?.full_name ?? user.email ?? "User",
    employeeId: profile?.employee_id ?? null,
    entityScope: profile?.entity_scope ?? null,
  };
}
