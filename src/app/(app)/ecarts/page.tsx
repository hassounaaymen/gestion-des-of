import Link from "next/link";
import { AlertTriangle, CheckCircle2, Scale, TrendingDown } from "lucide-react";
import { getEcarts } from "@/services/ecarts.service";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { ORDER_STATUS, QUALITY_DECISION } from "@/lib/status";
import { formatEcart } from "@/lib/reconciliation";
import { formatDate, formatNumber, cn } from "@/lib/utils";
import { getSession } from "@/lib/session";
import { scopeUsines } from "@/lib/rbac";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function EcartsPage({
  searchParams,
}: {
  searchParams: Promise<{ all?: string }>;
}) {
  const { all } = await searchParams;
  const showAll = all === "1";
  const session = await getSession();
  if (!session) redirect("/login");
  const data = await getEcarts({ onlyWithEcart: !showAll, usines: scopeUsines(session) });

  return (
    <div>
      <PageHeader
        title="Écarts Production / Qualité"
        description="Confrontation entre les quantités déclarées par la Production et celles validées par la Qualité"
      />

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="OF contrôlés" value={formatNumber(data.totalControles)} icon={Scale} />
        <Stat
          label="OF avec écart"
          value={formatNumber(data.avecEcart)}
          icon={AlertTriangle}
          tone={data.avecEcart > 0 ? "destructive" : "success"}
        />
        <Stat
          label="Écarts majeurs"
          value={formatNumber(data.majeurs)}
          icon={TrendingDown}
          tone={data.majeurs > 0 ? "destructive" : "success"}
          hint="> 5 % de la production"
        />
        <Stat
          label="Taux de concordance"
          value={`${formatNumber(data.tauxConcordance, 1)} %`}
          icon={CheckCircle2}
          tone={data.tauxConcordance >= 95 ? "success" : "warning"}
          hint={`${formatNumber(data.qteEcartConforme)} unité(s) d'écart cumulé`}
        />
      </div>

      <div className="mb-4 flex items-center gap-2">
        <Link
          href="/ecarts"
          className={cn(
            "rounded-md border px-3 py-1.5 text-sm font-medium transition-colors",
            !showAll ? "border-primary bg-primary/10 text-primary" : "text-muted-foreground hover:bg-accent",
          )}
        >
          Écarts uniquement
        </Link>
        <Link
          href="/ecarts?all=1"
          className={cn(
            "rounded-md border px-3 py-1.5 text-sm font-medium transition-colors",
            showAll ? "border-primary bg-primary/10 text-primary" : "text-muted-foreground hover:bg-accent",
          )}
        >
          Tous les OF contrôlés
        </Link>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead rowSpan={2}>N° OF</TableHead>
            <TableHead rowSpan={2}>Article</TableHead>
            <TableHead rowSpan={2}>Atelier / Équipe</TableHead>
            <TableHead colSpan={2} className="border-l text-center">Production</TableHead>
            <TableHead colSpan={2} className="border-l text-center">Qualité</TableHead>
            <TableHead className="border-l text-right">Écart</TableHead>
            <TableHead rowSpan={2}>Décision</TableHead>
          </TableRow>
          <TableRow>
            <TableHead className="border-l text-right">Produite</TableHead>
            <TableHead className="text-right">Bonne</TableHead>
            <TableHead className="border-l text-right">Contrôlée</TableHead>
            <TableHead className="text-right">Conforme</TableHead>
            <TableHead className="border-l text-right">sur conforme</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.rows.length === 0 && (
            <TableRow>
              <TableCell colSpan={9} className="py-10 text-center text-muted-foreground">
                {showAll
                  ? "Aucun OF n'a encore fait l'objet d'un contrôle quantitatif."
                  : "Aucun écart : les validations Qualité concordent avec les déclarations Production."}
              </TableCell>
            </TableRow>
          )}
          {data.rows.map((r) => {
            const st = ORDER_STATUS[r.status];
            const dec = r.decision ? QUALITY_DECISION[r.decision] : null;
            const ecart = r.rec.ecartConforme;
            return (
              <TableRow key={r.orderId} className={cn(r.rec.level === "MAJEUR" && "bg-destructive/5")}>
                <TableCell className="font-medium">
                  <Link href={`/orders/${r.orderId}`} className="text-primary hover:underline">
                    {r.number}
                  </Link>
                  <div className="text-xs text-muted-foreground">{formatDate(r.date)}</div>
                </TableCell>
                <TableCell>
                  <div className="max-w-56 truncate font-medium">{r.articleDesignation}</div>
                  <div className="font-mono text-xs text-muted-foreground">{r.articleCode}</div>
                </TableCell>
                <TableCell className="text-sm">
                  {r.atelier ?? "—"}
                  <div className="text-xs text-muted-foreground">{r.equipe ?? "—"}</div>
                </TableCell>
                <TableCell className="border-l text-right">{formatNumber(r.production.produite)}</TableCell>
                <TableCell className="text-right">{formatNumber(r.production.bonne)}</TableCell>
                <TableCell className="border-l text-right">{formatNumber(r.qualite.controlee)}</TableCell>
                <TableCell className="text-right">{formatNumber(r.qualite.conforme)}</TableCell>
                <TableCell
                  className={cn(
                    "border-l text-right font-bold",
                    Math.abs(ecart) < 0.001
                      ? "text-muted-foreground"
                      : r.rec.level === "MAJEUR"
                        ? "text-destructive"
                        : "text-warning",
                  )}
                >
                  {formatEcart(ecart)}
                  {r.rec.hasEcart && (
                    <div className="text-[11px] font-normal text-muted-foreground">
                      {formatNumber(r.rec.ecartConformePct, 1)} %
                    </div>
                  )}
                </TableCell>
                <TableCell>
                  {dec ? <Badge variant={dec.variant}>{dec.label}</Badge> : <Badge variant={st.variant}>{st.label}</Badge>}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>

      <p className="mt-4 text-xs text-muted-foreground">
        L'écart « sur conforme » compare la quantité déclarée bonne par la Production à la quantité
        réellement validée conforme par la Qualité. Un écart négatif signifie que la Production a
        sur-déclaré. Au-delà de 5 % de la quantité produite, l'écart est classé majeur.
      </p>
    </div>
  );
}

function Stat({
  label,
  value,
  icon: Icon,
  tone = "default",
  hint,
}: {
  label: string;
  value: string;
  icon: React.ComponentType<{ className?: string }>;
  tone?: "default" | "success" | "warning" | "destructive";
  hint?: string;
}) {
  const tones = {
    default: "bg-primary/10 text-primary",
    success: "bg-success/15 text-success",
    warning: "bg-warning/15 text-warning",
    destructive: "bg-destructive/15 text-destructive",
  };
  return (
    <Card className="p-5">
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <p className="text-sm font-medium text-muted-foreground">{label}</p>
          <p className="text-2xl font-bold tracking-tight">{value}</p>
          {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
        </div>
        <div className={cn("flex h-11 w-11 items-center justify-center rounded-lg", tones[tone])}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </Card>
  );
}
