import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ORDER_STATUS, QUALITY_DECISION } from "@/lib/status";
import { formatDate } from "@/lib/utils";
import { getSession } from "@/lib/session";
import { scopeUsine } from "@/lib/rbac";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function QualityPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  const usine = scopeUsine(session);
  const orders = await prisma.productionOrder.findMany({
    where: {
      status: { in: ["PRODUCTION_VALIDATED", "QUALITY_VALIDATED"] },
      ...(usine ? { store: { unite: usine } } : {}),
    },
    include: { article: true, qualityControls: true },
    orderBy: { productionValidatedAt: "desc" },
  });

  return (
    <div>
      <PageHeader title="Contrôle qualité" description="Ordres validés en production, en attente ou en cours de contrôle" />
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>N° OF</TableHead>
            <TableHead>Article</TableHead>
            <TableHead>Statut OF</TableHead>
            <TableHead>Décision qualité</TableHead>
            <TableHead>Validé prod. le</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {orders.length === 0 && (
            <TableRow><TableCell colSpan={5} className="py-10 text-center text-muted-foreground">Aucun OF à contrôler.</TableCell></TableRow>
          )}
          {orders.map((o) => {
            const q = o.qualityControls[0];
            const dec = q ? QUALITY_DECISION[q.decision] : null;
            return (
              <TableRow key={o.id}>
                <TableCell className="font-medium">
                  <Link href={`/orders/${o.id}`} className="text-primary hover:underline">{o.number}</Link>
                </TableCell>
                <TableCell>{o.article.designation}</TableCell>
                <TableCell><Badge variant={ORDER_STATUS[o.status].variant}>{ORDER_STATUS[o.status].label}</Badge></TableCell>
                <TableCell>{dec ? <Badge variant={dec.variant}>{dec.label}</Badge> : <span className="text-muted-foreground text-sm">Non saisi</span>}</TableCell>
                <TableCell className="text-sm text-muted-foreground">{formatDate(o.productionValidatedAt)}</TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
