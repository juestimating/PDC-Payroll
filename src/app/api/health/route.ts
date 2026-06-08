import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

// Always run at request time — this does live database I/O.
export const dynamic = "force-dynamic";

/**
 * Health check that proves the Supabase connection end to end. Uses the
 * server-only admin client to count departments. Returns 200 when connected,
 * 503 otherwise. Handy for uptime monitors and verifying a Vercel deploy.
 */
export async function GET() {
  try {
    const supabase = getSupabaseAdmin();
    const { count, error } = await supabase
      .from("departments")
      .select("*", { count: "exact", head: true });

    if (error) throw error;

    return NextResponse.json({
      status: "ok",
      database: "connected",
      departments: count ?? 0,
    });
  } catch (e) {
    return NextResponse.json(
      { status: "error", database: "disconnected", message: (e as Error).message },
      { status: 503 },
    );
  }
}
