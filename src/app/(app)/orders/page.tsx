import Link from "next/link";
import { Plus } from "lucide-react";
import { orderService } from "@/services/order.service";
import { getSession } from "@/lib/session";
import { can } from "@/lib/rbac";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ORDER_STATUS } from "@/lib/status";
import { formatDate, formatNumber } from "@/lib/utils";
import { scopeUsines } from "@/lib/rbac";

export const dynamic = "force-dynamic";

export default async function OrdersPage() {
  const session = await getSession();
  const orders = await orderService.list({ usines: session ? scopeUsines(session) : null });
  const canCreate = session && can(session.role, "order:create");

  return (
    <div>
      <PageHeader
        title="Ordres de fabrication"
        description={`${orders.length} ordre(s) au total`}
        action={
          canCreate ? (
            <Button asChild>
              <Link href="/orders/new">
                <Plus className="h-4 w-4" /> Nouvel OF
              </Link>
            </Button>
          ) : undefined
        }
      />

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>N° OF</TableHead>
            <TableHead>Article</TableHead>
            <TableHead>Magasin</TableHead>
            <TableHead>Atelier / Équipe</TableHead>
            <TableHead className="text-right">Qté bonne</TableHead>
            <TableHead>Statut</TableHead>
            <TableHead>Date</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {orders.length === 0 && (
            <TableRow>
              <TableCell colSpan={7} className="py-10 text-center text-muted-foreground">
                Aucun ordre de fabrication.
              </TableCell>
            </TableRow>
          )}
          {orders.map((o) => {
            const st = ORDER_STATUS[o.status];
            const bonne = o.productionLines.reduce((s, l) => s + l.qteBonne, 0);
            return (
              <TableRow key={o.id} className="cursor-pointer">
                <TableCell className="font-medium">
                  <Link href={`/orders/${o.id}`} className="text-primary hover:underline">
                    {o.number}
                  </Link>
                </TableCell>
                <TableCell>
                  <div className="font-medium">{o.article.designation}</div>
                  <div className="text-xs text-muted-foreground">{o.article.code}</div>
                </TableCell>
                <TableCell className="text-sm">{o.store.designation}</TableCell>
                <TableCell className="text-sm">
                  {o.atelier ?? "—"} · {o.equipe ?? "—"}
                </TableCell>
                <TableCell className="text-right font-medium">{formatNumber(bonne)}</TableCell>
                <TableCell>
                  <Badge variant={st.variant}>{st.label}</Badge>
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">{formatDate(o.date)}</TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
