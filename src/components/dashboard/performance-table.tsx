import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatNumber, cn } from "@/lib/utils";
import type { PerfRow } from "@/services/dashboard.service";

export function PerformanceTable({
  title,
  rows,
  emptyLabel,
}: {
  title: string;
  rows: PerfRow[];
  emptyLabel: string;
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        {rows.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">{emptyLabel}</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nom</TableHead>
                <TableHead className="text-right">OF</TableHead>
                <TableHead className="text-right">Produit</TableHead>
                <TableHead className="text-right">Rebut</TableHead>
                <TableHead className="text-right">Taux rebut</TableHead>
                <TableHead className="text-right">Rendement</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.name}>
                  <TableCell className="font-medium">{r.name}</TableCell>
                  <TableCell className="text-right text-muted-foreground">{r.ordres}</TableCell>
                  <TableCell className="text-right">{formatNumber(r.produite)}</TableCell>
                  <TableCell className="text-right">{formatNumber(r.rebut)}</TableCell>
                  <TableCell
                    className={cn(
                      "text-right font-medium",
                      r.tauxRebut <= 3 ? "text-success" : r.tauxRebut <= 5 ? "text-warning" : "text-destructive",
                    )}
                  >
                    {formatNumber(r.tauxRebut, 1)} %
                  </TableCell>
                  <TableCell
                    className={cn(
                      "text-right font-medium",
                      r.rendement >= 95 ? "text-success" : r.rendement >= 90 ? "text-warning" : "text-destructive",
                    )}
                  >
                    {formatNumber(r.rendement, 1)} %
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
