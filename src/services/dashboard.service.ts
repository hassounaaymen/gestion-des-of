import { prisma } from "@/lib/prisma";
import { OrderStatus, QualityDecision } from "@prisma/client";
import { getEcarts } from "./ecarts.service";

export interface PerfRow {
  name: string;
  produite: number;
  bonne: number;
  rebut: number;
  tauxRebut: number;
  rendement: number;
  ordres: number;
}

export interface DashboardData {
  kpis: {
    inProgress: number;
    completed: number;
    todayProduction: number;
    qteBonne: number;
    qteRebut: number;
    tauxRebut: number;
    rendement: number;
    openNc: number;
    ecarts: number;
    tauxConcordance: number;
  };
  dailyProduction: { day: string; bonne: number; rebut: number }[];
  topArticles: { name: string; value: number }[];
  topRejects: { name: string; value: number }[];
  defectPareto: { cause: string; value: number }[];
  defectByM5: { name: string; value: number }[];
  qualityBreakdown: { name: string; value: number }[];
  perfAtelier: PerfRow[];
  perfEquipe: PerfRow[];
  erp: { articles: number; manufactured: number; stores: number; lastSync: Date | null };
}

/** Agrège les lignes de production par clé (atelier, équipe, …). */
function aggregateBy(
  orders: {
    atelier: string | null;
    equipe: string | null;
    productionLines: { qteProduite: number; qteBonne: number; qteRebut: number }[];
  }[],
  key: "atelier" | "equipe",
): PerfRow[] {
  const map = new Map<string, PerfRow>();
  for (const o of orders) {
    const name = o[key]?.trim();
    if (!name) continue;
    const row =
      map.get(name) ??
      { name, produite: 0, bonne: 0, rebut: 0, tauxRebut: 0, rendement: 0, ordres: 0 };
    row.ordres += 1;
    for (const l of o.productionLines) {
      row.produite += l.qteProduite;
      row.bonne += l.qteBonne;
      row.rebut += l.qteRebut;
    }
    map.set(name, row);
  }
  return Array.from(map.values())
    .map((r) => ({
      ...r,
      tauxRebut: r.produite > 0 ? (r.rebut / r.produite) * 100 : 0,
      rendement: r.produite > 0 ? (r.bonne / r.produite) * 100 : 0,
    }))
    .sort((a, b) => b.produite - a.produite);
}

export async function getDashboardData(): Promise<DashboardData> {
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  const [
    inProgress,
    completed,
    lines,
    todayLines,
    openNc,
    controls,
    orders,
    articleCount,
    manufacturedCount,
    storeCount,
    lastSynced,
  ] = await Promise.all([
    prisma.productionOrder.count({ where: { status: OrderStatus.IN_PRODUCTION } }),
    prisma.productionOrder.count({ where: { status: OrderStatus.CLOSED } }),
    prisma.productionLine.findMany({
      select: {
        qteBonne: true, qteRebut: true, qteProduite: true,
        causeRebut: true, causeRebutM5: true,
      },
    }),
    prisma.productionLine.findMany({
      where: { updatedAt: { gte: startOfDay } },
      select: { qteProduite: true },
    }),
    prisma.nonConformity.count({ where: { status: { not: "CLOTUREE" } } }),
    prisma.qualityControl.groupBy({ by: ["decision"], _count: true }),
    prisma.productionOrder.findMany({
      include: { article: true, productionLines: true },
    }),
    prisma.article.count(),
    prisma.article.count({ where: { isManufactured: true } }),
    prisma.store.count(),
    prisma.article.findFirst({ orderBy: { syncedAt: "desc" }, select: { syncedAt: true } }),
  ]);

  const qteBonne = lines.reduce((s, l) => s + l.qteBonne, 0);
  const qteRebut = lines.reduce((s, l) => s + l.qteRebut, 0);
  const qteProduite = lines.reduce((s, l) => s + l.qteProduite, 0);
  const tauxRebut = qteProduite > 0 ? (qteRebut / qteProduite) * 100 : 0;
  const rendement = qteProduite > 0 ? (qteBonne / qteProduite) * 100 : 0;
  const todayProduction = todayLines.reduce((s, l) => s + l.qteProduite, 0);

  // Production des 7 derniers jours, par date de création d'OF
  const dayNames = ["Dim", "Lun", "Mar", "Mer", "Jeu", "Ven", "Sam"];
  const buckets: { key: string; day: string; bonne: number; rebut: number }[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() - i);
    buckets.push({ key: d.toDateString(), day: dayNames[d.getDay()], bonne: 0, rebut: 0 });
  }
  for (const o of orders) {
    const k = new Date(o.date).toDateString();
    const b = buckets.find((x) => x.key === k);
    if (!b) continue;
    for (const l of o.productionLines) {
      b.bonne += l.qteBonne;
      b.rebut += l.qteRebut;
    }
  }
  const dailyProduction = buckets.map(({ day, bonne, rebut }) => ({ day, bonne, rebut }));

  // Top articles (quantité bonne) et top rejets (quantité rebut)
  const bonneByArticle = new Map<string, number>();
  const rebutByArticle = new Map<string, number>();
  for (const o of orders) {
    const label = o.article.designation;
    const bonne = o.productionLines.reduce((s, l) => s + l.qteBonne, 0);
    const rebut = o.productionLines.reduce((s, l) => s + l.qteRebut, 0);
    if (bonne > 0) bonneByArticle.set(label, (bonneByArticle.get(label) ?? 0) + bonne);
    if (rebut > 0) rebutByArticle.set(label, (rebutByArticle.get(label) ?? 0) + rebut);
  }
  const toTop = (m: Map<string, number>) =>
    Array.from(m.entries())
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 5);

  // Pareto des défauts par cause de rebut
  const causeMap = new Map<string, number>();
  for (const l of lines) {
    if (l.causeRebut?.trim() && l.qteRebut > 0) {
      const c = l.causeRebut.trim();
      causeMap.set(c, (causeMap.get(c) ?? 0) + l.qteRebut);
    }
  }
  const defectPareto = Array.from(causeMap.entries())
    .map(([cause, value]) => ({ cause, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 6);

  // Répartition des rebuts par axe 5M (Ishikawa)
  const m5Map = new Map<string, number>();
  for (const l of lines) {
    if (l.causeRebutM5?.trim() && l.qteRebut > 0) {
      const k = l.causeRebutM5.trim();
      m5Map.set(k, (m5Map.get(k) ?? 0) + l.qteRebut);
    }
  }
  const defectByM5 = Array.from(m5Map.entries())
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);

  const decisionLabels: Record<QualityDecision, string> = {
    CONFORME: "Conforme",
    PARTIEL: "Conforme partiel",
    NON_CONFORME: "Non conforme",
    EN_ATTENTE: "En attente",
  };
  const qualityBreakdown = controls.map((c) => ({
    name: decisionLabels[c.decision],
    value: c._count,
  }));

  // Écarts Production / Qualité
  const ecartsData = await getEcarts({ onlyWithEcart: true });

  return {
    kpis: {
      inProgress,
      completed,
      todayProduction,
      qteBonne,
      qteRebut,
      tauxRebut,
      rendement,
      openNc,
      ecarts: ecartsData.avecEcart,
      tauxConcordance: ecartsData.tauxConcordance,
    },
    dailyProduction,
    topArticles: toTop(bonneByArticle),
    topRejects: toTop(rebutByArticle),
    defectPareto,
    defectByM5,
    qualityBreakdown,
    perfAtelier: aggregateBy(orders, "atelier"),
    perfEquipe: aggregateBy(orders, "equipe"),
    erp: {
      articles: articleCount,
      manufactured: manufacturedCount,
      stores: storeCount,
      lastSync: lastSynced?.syncedAt ?? null,
    },
  };
}
