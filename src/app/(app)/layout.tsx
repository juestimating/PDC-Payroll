import { AppStateProvider } from "@/components/providers/app-state";
import { WorkspaceProvider } from "@/components/providers/workspace";
import { AppShell } from "@/components/layout/app-shell";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <AppStateProvider>
      <WorkspaceProvider>
        <AppShell>{children}</AppShell>
      </WorkspaceProvider>
    </AppStateProvider>
  );
}
