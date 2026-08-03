import { prisma } from "@/lib/prisma";
import type { OrderStatus, Priorite } from "@prisma/client";

/**
 * Planning de production : charge par atelier (ligne) sur un horizon de jours.
 *
 * L'ordonnancement s'appuie sur la période [dateDebut, dateFinPrev] de l'OF.
 * À défaut de dates, l'OF est rattaché à sa date de création — il apparaît
 * alors comme « non planifié » et doit être daté par le responsable.
 */

export interface PlanningOrder {
  id: string;
  number: string;
  articleCode: string;
  articleDesignation: string;
  atelier: string;
  equipe: string | null;
  chefEquipe: string | null;
  status: OrderStatus;
  priorite: Priorite;
  /** Ligne de production ERP de l'article, proposée comme atelier par défaut */
  suggestedAtelier: string | null;
  dateDebut: Date | null;
  dateFinPrev: Date | null;
  qtePrevue: number;
  qteProduite: number;
  avancement: number;
  /** Index de la colonne de départ dans l'horizon, et durée en jours */
  startIndex: number;
  span: number;
  planned: boolean;
  late: boolean;
}

export interface PlanningAtelier {
  atelier: string;
  orders: PlanningOrder[];
  chargePrevue: number;
  chargeRealisee: number;
}

export interface PlanningData {
  days: {
    date: Date;
    iso: string;
    label: string;
    dayName: string;
    isToday: boolean;
    isWeekend: boolean;
  }[];
  ateliers: PlanningAtelier[];
  unplanned: PlanningOrder[];
  /** Ateliers déjà utilisés + lignes de production ERP, pour l'auto-complétion */
  knownAteliers: string[];
  /** Unités de production disponibles (usines), pour le filtre */
  knownUnites: string[];
  from: Date;
  to: Date;
  totalOrders: number;
  /** Périmètre usine appliqué ; `null` = toutes les usines */
  usines: string[] | null;
}

const DAY_MS = 86_400_000;
const DAY_NAMES = ["Dim", "Lun", "Mar", "Mer", "Jeu", "Ven", "Sam"];

function startOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

export async function getPlanning(options?: {
  from?: Date;
  /** Fin d'horizon explicite ; prioritaire sur `days` */
  to?: Date;
  days?: number;
  /** Filtre sur les unités de production (usines) rattachées au magasin */
  usines?: string[] | null;
}): Promise<PlanningData> {
  const from = startOfDay(options?.from ?? new Date());
  const horizon = options?.to
    ? Math.min(
        Math.max(
          Math.round((startOfDay(options.to).getTime() - from.getTime()) / DAY_MS) + 1,
          1,
        ),
        60,
      )
    : (options?.days ?? 14);
  const to = new Date(from.getTime() + (horizon - 1) * DAY_MS);
  const usines = options?.usines?.length ? options.usines : null;
  const today = startOfDay(new Date()).getTime();

  const days = Array.from({ length: horizon }, (_, i) => {
    const date = new Date(from.getTime() + i * DAY_MS);
    return {
      date,
      iso: date.toISOString(),
      label: `${String(date.getDate()).padStart(2, "0")}/${String(date.getMonth() + 1).padStart(2, "0")}`,
      dayName: DAY_NAMES[date.getDay()],
      isToday: date.getTime() === today,
      isWeekend: date.getDay() === 0 || date.getDay() === 6,
    };
  });

  // Les OF clos ou annulés ne chargent plus l'atelier
  const orders = await prisma.productionOrder.findMany({
    where: {
      status: { notIn: ["CLOSED", "CANCELLED"] },
      ...(usines ? { store: { unite: { in: usines } } } : {}),
    },
    include: { article: true, productionLines: true },
    orderBy: [{ dateDebut: "asc" }, { createdAt: "asc" }],
  });

  const unplanned: PlanningOrder[] = [];
  const byAtelier = new Map<string, PlanningOrder[]>();

  for (const o of orders) {
    const qtePrevue = o.productionLines.reduce((s, l) => s + l.qtePrevue, 0);
    const qteProduite = o.productionLines.reduce((s, l) => s + l.qteProduite, 0);
    const atelier = o.atelier?.trim() || "Non affecté";

    const debut = o.dateDebut ? startOfDay(o.dateDebut) : null;
    const fin = o.dateFinPrev ? startOfDay(o.dateFinPrev) : debut;

    const row: PlanningOrder = {
      id: o.id,
      number: o.number,
      articleCode: o.article.code,
      articleDesignation: o.article.designation,
      atelier,
      equipe: o.equipe,
      chefEquipe: o.chefEquipe,
      status: o.status,
      priorite: o.priorite,
      suggestedAtelier: o.article.productionLine,
      dateDebut: o.dateDebut,
      dateFinPrev: o.dateFinPrev,
      qtePrevue,
      qteProduite,
      avancement: qtePrevue > 0 ? Math.min(100, (qteProduite / qtePrevue) * 100) : 0,
      startIndex: 0,
      span: 1,
      planned: Boolean(debut),
      late: Boolean(fin && fin.getTime() < today && o.status !== "CLOSED"),
    };

    if (!debut || !fin) {
      unplanned.push(row);
      continue;
    }

    // Découpe sur l'horizon affiché
    const startIdx = Math.round((debut.getTime() - from.getTime()) / DAY_MS);
    const endIdx = Math.round((fin.getTime() - from.getTime()) / DAY_MS);
    if (endIdx < 0 || startIdx > horizon - 1) continue; // hors fenêtre

    row.startIndex = Math.max(0, startIdx);
    row.span = Math.max(1, Math.min(horizon - 1, endIdx) - row.startIndex + 1);

    const list = byAtelier.get(atelier) ?? [];
    list.push(row);
    byAtelier.set(atelier, list);
  }

  // À date de début égale, l'urgence passe devant
  const RANG: Record<Priorite, number> = { URGENTE: 0, HAUTE: 1, NORMALE: 2, BASSE: 3 };

  const ateliers: PlanningAtelier[] = Array.from(byAtelier.entries())
    .map(([atelier, list]) => ({
      atelier,
      orders: list.sort(
        (a, b) =>
          a.startIndex - b.startIndex ||
          RANG[a.priorite] - RANG[b.priorite] ||
          a.number.localeCompare(b.number),
      ),
      chargePrevue: list.reduce((s, r) => s + r.qtePrevue, 0),
      chargeRealisee: list.reduce((s, r) => s + r.qteProduite, 0),
    }))
    .sort((a, b) => b.chargePrevue - a.chargePrevue);

  // Auto-complétion : ateliers déjà saisis + lignes de production du référentiel ERP
  const [usedAteliers, erpLines, unites] = await Promise.all([
    prisma.productionOrder.findMany({
      where: { atelier: { not: null } },
      distinct: ["atelier"],
      select: { atelier: true },
    }),
    prisma.article.findMany({
      where: { productionLine: { not: null }, isManufactured: true },
      distinct: ["productionLine"],
      select: { productionLine: true },
    }),
    prisma.store.findMany({
      where: { unite: { not: null } },
      distinct: ["unite"],
      select: { unite: true },
      orderBy: { unite: "asc" },
    }),
  ]);
  const knownAteliers = Array.from(
    new Set(
      [
        ...usedAteliers.map((a) => a.atelier),
        ...erpLines.map((l) => l.productionLine),
      ].filter((x): x is string => Boolean(x?.trim())),
    ),
  ).sort();

  return {
    days,
    ateliers,
    unplanned,
    knownAteliers,
    knownUnites: unites.map((u) => u.unite!).filter(Boolean),
    from,
    to,
    usines,
    totalOrders: ateliers.reduce((s, a) => s + a.orders.length, 0) + unplanned.length,
  };
}
