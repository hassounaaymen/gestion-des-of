import { Lock } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatDateTime } from "@/lib/utils";

export const dynamic = "force-dynamic";

const STORE_TYPES: Record<string, { label: string; variant: "success" | "warning" | "outline" }> = {
  PRODUIT_FINI: { label: "Produits finis", variant: "success" },
  MATIERE_PREMIERE: { label: "Matières premières", variant: "warning" },
  AUTRE: { label: "Autre", variant: "outline" },
};

export default async function StoresPage() {
  const stores = await prisma.store.findMany({
    orderBy: [{ type: "asc" }, { code: "asc" }],
    include: { _count: { select: { productionOrders: true } } },
  });

  return (
    <div>
      <PageHeader
        title="Magasins (ERP)"
        description={`${stores.length} emplacements issus des écritures article Business Central — lecture seule`}
      />
      <div className="mb-4 flex items-center gap-2 rounded-md border bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
        <Lock className="h-4 w-4" />
        Ces informations proviennent uniquement de l'ERP et ne sont pas modifiables dans l'application.
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Code magasin</TableHead>
            <TableHead>Désignation</TableHead>
            <TableHead>Nature</TableHead>
            <TableHead className="text-right">OF liés</TableHead>
            <TableHead>Dernière synchro.</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {stores.map((s) => {
            const t = STORE_TYPES[s.type] ?? STORE_TYPES.AUTRE;
            return (
              <TableRow key={s.id}>
                <TableCell className="font-mono text-sm">{s.code}</TableCell>
                <TableCell className="font-medium">{s.designation}</TableCell>
                <TableCell><Badge variant={t.variant}>{t.label}</Badge></TableCell>
                <TableCell className="text-right">{s._count.productionOrders}</TableCell>
                <TableCell className="text-sm text-muted-foreground">{formatDateTime(s.syncedAt)}</TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
