import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { can, ROLE_LABELS } from "@/lib/rbac";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatDateTime } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function UsersPage() {
  const session = await getSession();
  if (!session || !can(session.role, "user:manage")) redirect("/dashboard");

  const users = await prisma.user.findMany({ orderBy: { createdAt: "asc" } });

  return (
    <div>
      <PageHeader title="Utilisateurs" description="Gestion des comptes et des rôles" />
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Nom complet</TableHead>
            <TableHead>Identifiant</TableHead>
            <TableHead>E-mail</TableHead>
            <TableHead>Rôle</TableHead>
            <TableHead>État</TableHead>
            <TableHead>Dernière connexion</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {users.map((u) => (
            <TableRow key={u.id}>
              <TableCell className="font-medium">{u.fullName}</TableCell>
              <TableCell className="font-mono text-sm">{u.username}</TableCell>
              <TableCell className="text-sm text-muted-foreground">{u.email}</TableCell>
              <TableCell><Badge variant="secondary">{ROLE_LABELS[u.role]}</Badge></TableCell>
              <TableCell>{u.isActive ? <Badge variant="success">Actif</Badge> : <Badge variant="destructive">Inactif</Badge>}</TableCell>
              <TableCell className="text-sm text-muted-foreground">{u.lastLogin ? formatDateTime(u.lastLogin) : "—"}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
