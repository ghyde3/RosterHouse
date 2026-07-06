import { requireUser } from "@/lib/auth";
import { EmployeeTabBar } from "@/components/chrome/EmployeeTabBar";
import { ToasterProvider } from "@/components/ui/Toaster";

export default async function EmployeeLayout({ children }: { children: React.ReactNode }) {
  await requireUser();

  return (
    <ToasterProvider>
      <div
        style={{
          maxWidth: 480,
          margin: "0 auto",
          minHeight: "100dvh",
          display: "flex",
          flexDirection: "column",
          background: "var(--surface-page)",
        }}
      >
        <div style={{ flex: 1, paddingBottom: 80 }}>{children}</div>
        <EmployeeTabBar />
      </div>
    </ToasterProvider>
  );
}
