import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { NC_GRAVITE, NC_STATUS } from "@/lib/status";
import { formatDate, formatNumber } from "@/lib/utils";
import { getSession } from "@/lib/session";
import { scopeUsines } from "@/lib/rbac";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function NonConformitiesPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  const usines = scopeUsines(session);
  const list = await prisma.nonConformity.findMany({
    where: usines ? { order: { store: { unite: { in: usines } } } } : {},
    include: { article: true, order: true, responsable: { select: { fullName: true } } },
    orderBy: { date: "desc" },
  });

  return (
    <div>
      <PageHeader title="Non-conformités" description={`${list.length} fiche(s) de non-conformité`} />
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>N° NC</TableHead>
            <TableHead>OF</TableHead>
            <TableHead>Article</TableHead>
            <TableHead>Nature</TableHead>
            <TableHead className="text-right">Quantité</TableHead>
            <TableHead>Gravité</TableHead>
            <TableHead>Statut</TableHead>
            <TableHead>Date</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {list.length === 0 && (
            <TableRow><TableCell colSpan={8} className="py-10 text-center text-muted-foreground">Aucune non-conformité.</TableCell></TableRow>
          )}
          {list.map((nc) => (
            <TableRow key={nc.id}>
              <TableCell className="font-medium">{nc.number}</TableCell>
              <TableCell>
                <Link href={`/orders/${nc.orderId}`} className="text-primary hover:underline">{nc.order.number}</Link>
              </TableCell>
              <TableCell>{nc.article.designation}</TableCell>
              <TableCell className="max-w-xs truncate text-sm">{nc.nature ?? "—"}</TableCell>
              <TableCell className="text-right font-medium">
                {nc.quantite > 0 ? formatNumber(nc.quantite) : "—"}
              </TableCell>
              <TableCell><Badge variant={NC_GRAVITE[nc.gravite].variant}>{NC_GRAVITE[nc.gravite].label}</Badge></TableCell>
              <TableCell><Badge variant={NC_STATUS[nc.status].variant}>{NC_STATUS[nc.status].label}</Badge></TableCell>
              <TableCell className="text-sm text-muted-foreground">{formatDate(nc.date)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
