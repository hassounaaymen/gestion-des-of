import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ORDER_STATUS } from "@/lib/status";
import { formatNumber } from "@/lib/utils";
import { getSession } from "@/lib/session";
import { scopeUsine } from "@/lib/rbac";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function ProductionPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  const usine = scopeUsine(session);
  const orders = await prisma.productionOrder.findMany({
    where: {
      status: { in: ["DRAFT", "IN_PRODUCTION"] },
      ...(usine ? { store: { unite: usine } } : {}),
    },
    include: { article: true, productionLines: true },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div>
      <PageHeader title="Saisie production" description="Ordres en cours de production à renseigner" />
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>N° OF</TableHead>
            <TableHead>Article</TableHead>
            <TableHead className="text-right">Prévu</TableHead>
            <TableHead className="text-right">Produit</TableHead>
            <TableHead className="text-right">Bon</TableHead>
            <TableHead className="text-right">Rebut</TableHead>
            <TableHead>Statut</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {orders.length === 0 && (
            <TableRow><TableCell colSpan={7} className="py-10 text-center text-muted-foreground">Aucun OF en production.</TableCell></TableRow>
          )}
          {orders.map((o) => {
            const l = o.productionLines[0];
            return (
              <TableRow key={o.id}>
                <TableCell className="font-medium">
                  <Link href={`/orders/${o.id}`} className="text-primary hover:underline">{o.number}</Link>
                </TableCell>
                <TableCell>{o.article.designation}</TableCell>
                <TableCell className="text-right">{formatNumber(l?.qtePrevue ?? 0)}</TableCell>
                <TableCell className="text-right">{formatNumber(l?.qteProduite ?? 0)}</TableCell>
                <TableCell className="text-right text-success">{formatNumber(l?.qteBonne ?? 0)}</TableCell>
                <TableCell className="text-right text-destructive">{formatNumber(l?.qteRebut ?? 0)}</TableCell>
                <TableCell><Badge variant={ORDER_STATUS[o.status].variant}>{ORDER_STATUS[o.status].label}</Badge></TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
