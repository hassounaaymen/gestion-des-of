import { getDashboardData } from "@/services/dashboard.service";
import { KpiCard } from "@/components/dashboard/kpi-card";
import {
  DailyProductionChart,
  TopArticlesChart,
  TopRejectsChart,
  DefectParetoChart,
  M5Chart,
  QualityPieChart,
} from "@/components/dashboard/charts";
import { PerformanceTable } from "@/components/dashboard/performance-table";
import { formatNumber, formatDateTime } from "@/lib/utils";
import { Database } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const data = await getDashboardData();
  const k = data.kpis;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Tableau de bord</h1>
          <p className="text-sm text-muted-foreground">
            Vue d'ensemble de la production en temps réel
          </p>
        </div>
        <div className="flex items-center gap-2 rounded-md border bg-card px-3 py-1.5 text-xs text-muted-foreground">
          <Database className="h-3.5 w-3.5" />
          Référentiel ERP : {formatNumber(data.erp.articles)} articles ·{" "}
          {formatNumber(data.erp.manufactured)} fabricables · {data.erp.stores} magasins
          {data.erp.lastSync && ` · maj ${formatDateTime(data.erp.lastSync)}`}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard index={0} label="Ordres en cours" value={formatNumber(k.inProgress)} icon="Activity" />
        <KpiCard index={1} label="Ordres terminés" value={formatNumber(k.completed)} icon="CheckCircle2" tone="success" />
        <KpiCard index={2} label="Production du jour" value={formatNumber(k.todayProduction)} icon="Factory" hint="unités produites" />
        <KpiCard index={3} label="Non-conformités ouvertes" value={formatNumber(k.openNc)} icon="AlertTriangle" tone="destructive" />
        <KpiCard index={4} label="Quantité bonne" value={formatNumber(k.qteBonne)} icon="PackageCheck" tone="success" />
        <KpiCard index={5} label="Quantité rebut" value={formatNumber(k.qteRebut)} icon="Trash2" tone="warning" />
        <KpiCard index={6} label="Taux de rebut" value={`${formatNumber(k.tauxRebut, 1)} %`} icon="Percent" tone={k.tauxRebut > 5 ? "destructive" : "warning"} />
        <KpiCard index={7} label="Rendement" value={`${formatNumber(k.rendement, 1)} %`} icon="Gauge" tone="success" />
        <KpiCard
          index={8}
          label="Écarts Prod. / Qualité"
          value={formatNumber(k.ecarts)}
          icon="GitCompareArrows"
          tone={k.ecarts > 0 ? "destructive" : "success"}
          hint="OF dont la Qualité diverge de la Production"
        />
        <KpiCard
          index={9}
          label="Taux de concordance"
          value={`${formatNumber(k.tauxConcordance, 1)} %`}
          icon="Scale"
          tone={k.tauxConcordance >= 95 ? "success" : "warning"}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <DailyProductionChart data={data.dailyProduction} />
        <TopArticlesChart data={data.topArticles} />
        <DefectParetoChart data={data.defectPareto} />
        <TopRejectsChart data={data.topRejects} />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <PerformanceTable
          title="Performance par atelier / ligne"
          rows={data.perfAtelier}
          emptyLabel="Aucun atelier renseigné sur les OF."
        />
        <PerformanceTable
          title="Performance par équipe"
          rows={data.perfEquipe}
          emptyLabel="Aucune équipe renseignée sur les OF."
        />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <M5Chart data={data.defectByM5} />
        <QualityPieChart data={data.qualityBreakdown} />
      </div>
    </div>
  );
}
