import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { AppSidebar } from "@/components/app-sidebar";
import { AppHeader } from "@/components/app-header";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();
  if (!session) redirect("/login");

  return (
    <div className="flex h-screen overflow-hidden">
      <AppSidebar role={session.role} />
      <div className="flex flex-1 flex-col overflow-hidden">
        <AppHeader fullName={session.fullName} role={session.role} />
        <main className="flex-1 overflow-y-auto p-6">{children}</main>
      </div>
    </div>
  );
}
