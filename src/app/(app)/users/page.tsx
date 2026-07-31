import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { can, scopeUsine } from "@/lib/rbac";
import { PageHeader } from "@/components/page-header";
import { UsersManager } from "@/features/users/users-manager";

export const dynamic = "force-dynamic";

export default async function UsersPage() {
  const session = await getSession();
  if (!session || !can(session.role, "user:manage")) redirect("/dashboard");

  const portee = scopeUsine(session);

  return (
    <div>
      <PageHeader
        title="Comptes utilisateurs"
        description={
          portee
            ? `Comptes rattachés à l'usine ${portee}`
            : "Comptes de toutes les usines"
        }
      />
      <UsersManager currentUserId={session.sub} />
    </div>
  );
}
