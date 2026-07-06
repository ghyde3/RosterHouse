import { requireManager } from "@/lib/auth";
import { getManagerLocation } from "@/lib/authz";
import { ManagerSidebar } from "@/components/chrome/ManagerSidebar";
import { ToasterProvider } from "@/components/ui/Toaster";

export default async function ManagerLayout({ children }: { children: React.ReactNode }) {
  const user = await requireManager();
  const location = await getManagerLocation(user.id);

  return (
    <ToasterProvider>
      <div style={{ display: "flex", minHeight: "100dvh", background: "var(--surface-page)" }}>
        <ManagerSidebar locationName={location.name} userName={user.name} />
        <main style={{ flex: 1, padding: "var(--space-8)", overflow: "auto" }}>{children}</main>
      </div>
    </ToasterProvider>
  );
}
