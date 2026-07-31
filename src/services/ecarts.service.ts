import { prisma } from "@/lib/prisma";
import { reconcile, type Reconciliation } from "@/lib/reconciliation";
import type { OrderStatus, QualityDecision } from "@prisma/client";

/**
 * Liste des écarts entre la déclaration Production et la validation Qualité.
 *
 * Un OF apparaît dès que la Qualité a contrôlé une quantité et que celle-ci
 * diverge de ce que la Production a déclaré.
 */

export interface EcartRow {
  orderId: string;
  number: string;
  date: Date;
  articleCode: string;
  articleDesignation: string;
  atelier: string | null;
  equipe: string | null;
  status: OrderStatus;
  decision: QualityDecision | null;
  controleur: string | null;
  production: { produite: number; bonne: number; rebut: number };
  qualite: { controlee: number; conforme: number; nonConforme: number };
  rec: Reconciliation;
}

export interface EcartsSummary {
  rows: EcartRow[];
  totalControles: number;
  avecEcart: number;
  majeurs: number;
  qteEcartConforme: number;
  tauxConcordance: number;
}

export async function getEcarts(options?: {
  onlyWithEcart?: boolean;
  /** Restreint au périmètre d'une usine */
  usine?: string | null;
}): Promise<EcartsSummary> {
  const orders = await prisma.productionOrder.findMany({
    where: {
      qualityControls: { some: {} },
      ...(options?.usine ? { store: { unite: options.usine } } : {}),
    },
    include: { article: true, productionLines: true, qualityControls: true },
    orderBy: { date: "desc" },
  });

  const all: EcartRow[] = orders.map((o) => {
    const prod = o.productionLines.reduce(
      (acc, l) => ({
        produite: acc.produite + l.qteProduite,
        bonne: acc.bonne + l.qteBonne,
        rebut: acc.rebut + l.qteRebut,
      }),
      { produite: 0, bonne: 0, rebut: 0 },
    );
    const qual = o.qualityControls.reduce(
      (acc, c) => ({
        controlee: acc.controlee + c.qteControlee,
        conforme: acc.conforme + c.qteConforme,
        nonConforme: acc.nonConforme + c.qteNonConforme,
      }),
      { controlee: 0, conforme: 0, nonConforme: 0 },
    );

    const rec = reconcile(
      { qteProduite: prod.produite, qteBonne: prod.bonne, qteRebut: prod.rebut },
      {
        qteControlee: qual.controlee,
        qteConforme: qual.conforme,
        qteNonConforme: qual.nonConforme,
      },
    );

    return {
      orderId: o.id,
      number: o.number,
      date: o.date,
      articleCode: o.article.code,
      articleDesignation: o.article.designation,
      atelier: o.atelier,
      equipe: o.equipe,
      status: o.status,
      decision: o.qualityControls[0]?.decision ?? null,
      controleur: o.qualityControls[0]?.controleur ?? null,
      production: prod,
      qualite: qual,
      rec,
    };
  });

  const controles = all.filter((r) => r.qualite.controlee > 0);
  const avecEcart = controles.filter((r) => r.rec.hasEcart);

  return {
    rows: options?.onlyWithEcart ? avecEcart : controles,
    totalControles: controles.length,
    avecEcart: avecEcart.length,
    majeurs: avecEcart.filter((r) => r.rec.level === "MAJEUR").length,
    qteEcartConforme: avecEcart.reduce((s, r) => s + Math.abs(r.rec.ecartConforme), 0),
    tauxConcordance:
      controles.length > 0
        ? ((controles.length - avecEcart.length) / controles.length) * 100
        : 100,
  };
}
