import { redirect } from "next/navigation";
import {
  FileSpreadsheet, FileText, ScrollText, AlertTriangle, GitCompareArrows, CalendarRange,
} from "lucide-react";
import { getSession } from "@/lib/session";
import { can } from "@/lib/rbac";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { prisma } from "@/lib/prisma";
import { formatNumber } from "@/lib/utils";

export const dynamic = "force-dynamic";

interface ReportDef {
  href: string;
  title: string;
  description: string;
  format: "Excel" | "PDF";
  icon: React.ComponentType<{ className?: string }>;
  count?: string;
}

export default async function ReportsPage() {
  const session = await getSession();
  if (!session || !can(session.role, "report:read")) redirect("/dashboard");
  const canExport = can(session.role, "report:export");

  const [orders, ncs, controls, planned] = await Promise.all([
    prisma.productionOrder.count(),
    prisma.nonConformity.count(),
    prisma.qualityControl.count({ where: { qteControlee: { gt: 0 } } }),
    prisma.productionOrder.count({
      where: { dateDebut: { not: null }, status: { notIn: ["CLOSED", "CANCELLED"] } },
    }),
  ]);

  const reports: ReportDef[] = [
    {
      href: "/api/export/pdf?type=synthesis",
      title: "Rapport de synthèse",
      description:
        "Vue Direction : indicateurs clés, performance par atelier et par équipe, Pareto des causes, axes 5M et écarts Production / Qualité.",
      format: "PDF",
      icon: ScrollText,
    },
    {
      href: "/api/export/pdf?type=planning",
      title: "Fiche planning de production",
      description:
        "Diagramme de Gantt en paysage : charge par atelier sur 14 jours, détail des ordres planifiés, OF non planifiés et cartouche de visas. À afficher en atelier.",
      format: "PDF",
      icon: CalendarRange,
      count: `${formatNumber(planned)} OF planifié(s)`,
    },
    {
      href: "/api/export/excel?type=orders",
      title: "Registre des ordres de fabrication",
      description:
        "Tous les OF avec la déclaration production, la validation qualité, les causes de rebut et l'écart entre les deux services.",
      format: "Excel",
      icon: FileSpreadsheet,
      count: `${formatNumber(orders)} ordre(s)`,
    },
    {
      href: "/api/export/excel?type=ecarts",
      title: "Écarts Production / Qualité",
      description:
        "Confrontation détaillée des quantités déclarées et validées, avec niveau d'écart et taux de concordance.",
      format: "Excel",
      icon: GitCompareArrows,
      count: `${formatNumber(controls)} contrôle(s)`,
    },
    {
      href: "/api/export/excel?type=nc",
      title: "Registre des non-conformités",
      description:
        "Fiches NC avec nature, quantité concernée, gravité, cause, action corrective et statut de traitement.",
      format: "Excel",
      icon: AlertTriangle,
      count: `${formatNumber(ncs)} fiche(s)`,
    },
  ];

  return (
    <div>
      <PageHeader
        title="Rapports & exports"
        description="Documents d'impression professionnelle et classeurs exploitables"
      />

      {!canExport && (
        <div className="mb-4 rounded-md border bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
          Votre rôle permet la consultation des rapports mais pas leur export.
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        {reports.map((r) => {
          const Icon = r.icon;
          const isPdf = r.format === "PDF";
          return (
            <Card key={r.href} className="transition-colors hover:border-primary/40">
              <CardContent className="flex gap-4 pt-6">
                <div
                  className={
                    isPdf
                      ? "flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-destructive/10 text-destructive"
                      : "flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-success/15 text-success"
                  }
                >
                  <Icon className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-semibold">{r.title}</h3>
                    <span
                      className={
                        isPdf
                          ? "rounded border border-destructive/30 px-1.5 py-0.5 text-[10px] font-bold text-destructive"
                          : "rounded border border-success/30 px-1.5 py-0.5 text-[10px] font-bold text-success"
                      }
                    >
                      {r.format}
                    </span>
                    {r.count && (
                      <span className="text-xs text-muted-foreground">{r.count}</span>
                    )}
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">{r.description}</p>
                  {canExport && (
                    <a
                      href={r.href}
                      className="mt-3 inline-flex h-8 items-center gap-2 rounded-md bg-primary px-3 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary/90"
                    >
                      {isPdf ? <FileText className="h-3.5 w-3.5" /> : <FileSpreadsheet className="h-3.5 w-3.5" />}
                      Télécharger
                    </a>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <p className="mt-6 text-xs text-muted-foreground">
        La fiche PDF d'un ordre de fabrication (avec visas Production, Qualité et Direction)
        se télécharge depuis la page de l'OF concerné.
      </p>
    </div>
  );
}
