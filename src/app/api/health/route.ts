import { NextResponse } from "next/server";

// Always run at request time so uptime monitors get a fresh response.
export const dynamic = "force-dynamic";

/**
 * Public liveness check. Intentionally does NOT touch the database and does NOT
 * use the service-role client — a public route must never hold a privileged
 * connection or leak row data. It only reports that the process is up and
 * whether the Supabase URL is configured in the environment.
 */
export async function GET() {
  return NextResponse.json({
    status: "ok",
    env: { supabase: Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL) },
  });
}
