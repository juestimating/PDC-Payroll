import { redirect } from "next/navigation";
import { AppStateProvider } from "@/components/providers/app-state";
import { WorkspaceProvider } from "@/components/providers/workspace";
import { AppShell } from "@/components/layout/app-shell";
import { getSessionProfile, hasSupabaseEnv } from "@/lib/supabase/server";
import type { AppUser, Role } from "@/lib/data";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const authed = hasSupabaseEnv();
  let initialRole: Role | undefined;
  let initialUser: AppUser | undefined;

  if (authed) {
    const sp = await getSessionProfile();
    if (!sp) redirect("/login");
    initialRole = sp.role;
    initialUser = {
      id: sp.userId,
      name: sp.fullName,
      role: sp.role,
      employeeId: sp.employeeId ?? undefined,
    };
  }

  return (
    <AppStateProvider authed={authed} initialRole={initialRole} initialUser={initialUser}>
      <WorkspaceProvider>
        <AppShell>{children}</AppShell>
      </WorkspaceProvider>
    </AppStateProvider>
  );
}
