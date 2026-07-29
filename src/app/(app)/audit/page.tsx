import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { can } from "@/lib/rbac";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatDateTime } from "@/lib/utils";

export const dynamic = "force-dynamic";

const ACTION_VARIANT: Record<string, "default" | "success" | "warning" | "destructive" | "secondary"> = {
  CREATE: "default",
  UPDATE: "secondary",
  VALIDATE_PRODUCTION: "warning",
  VALIDATE_QUALITY: "success",
  CLOSE: "success",
  LOGIN: "secondary",
  LOGOUT: "secondary",
  ERP_SYNC: "default",
};

export default async function AuditPage() {
  const session = await getSession();
  if (!session || !can(session.role, "audit:read")) redirect("/dashboard");

  const logs = await prisma.auditLog.findMany({
    include: { user: { select: { fullName: true } } },
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  return (
    <div>
      <PageHeader
        title="Historique"
        description="Journal immuable de toutes les actions — qui, quand, avant/après, IP, navigateur"
      />
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Date</TableHead>
            <TableHead>Utilisateur</TableHead>
            <TableHead>Action</TableHead>
            <TableHead>Entité</TableHead>
            <TableHead>IP</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {logs.length === 0 && (
            <TableRow><TableCell colSpan={5} className="py-10 text-center text-muted-foreground">Aucun événement.</TableCell></TableRow>
          )}
          {logs.map((log) => (
            <TableRow key={log.id}>
              <TableCell className="whitespace-nowrap text-sm text-muted-foreground">{formatDateTime(log.createdAt)}</TableCell>
              <TableCell className="text-sm">{log.user?.fullName ?? "—"}</TableCell>
              <TableCell><Badge variant={ACTION_VARIANT[log.action] ?? "secondary"}>{log.action}</Badge></TableCell>
              <TableCell className="text-sm">{log.entity}{log.entityId ? <span className="text-muted-foreground"> · {log.entityId.slice(0, 8)}</span> : null}</TableCell>
              <TableCell className="font-mono text-xs text-muted-foreground">{log.ipAddress ?? "—"}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
