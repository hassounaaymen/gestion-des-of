import { prisma } from "@/lib/prisma";
import { OrderStatus, Role } from "@prisma/client";
import { ApiError } from "@/lib/api";
import { writeAudit } from "@/lib/audit";
import type {
  OrderCreateInput,
  PlanningInput,
  ProductionInput,
  QualityInput,
} from "@/lib/validations";
import { NotificationType } from "@prisma/client";

/** Génère le prochain numéro d'OF: OF-YYYY-NNNN */
async function nextOrderNumber(): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `OF-${year}-`;
  const last = await prisma.productionOrder.findFirst({
    where: { number: { startsWith: prefix } },
    orderBy: { number: "desc" },
    select: { number: true },
  });
  const seq = last ? Number(last.number.slice(prefix.length)) + 1 : 1;
  return `${prefix}${String(seq).padStart(4, "0")}`;
}

/**
 * Vérifie qu'un ordre appartient bien au périmètre de l'appelant.
 * On répond 404 plutôt que 403 : un utilisateur ne doit pas pouvoir déduire
 * l'existence d'un ordre appartenant à une autre usine.
 */
async function assertScope(orderId: string, usine?: string | null) {
  if (!usine) return;
  const ok = await prisma.productionOrder.findFirst({
    where: { id: orderId, store: { unite: usine } },
    select: { id: true },
  });
  if (!ok) throw new ApiError(404, "OF introuvable");
}

async function notifyRole(role: Role, type: NotificationType, title: string, message: string, link?: string) {
  const users = await prisma.user.findMany({ where: { role, isActive: true }, select: { id: true } });
  if (users.length === 0) return;
  await prisma.notification.createMany({
    data: users.map((u) => ({ userId: u.id, type, title, message, link })),
  });
}

export const orderService = {
  list(filters?: { status?: OrderStatus; q?: string; usine?: string | null }) {
    return prisma.productionOrder.findMany({
      where: {
        status: filters?.status,
        // Cloisonnement par usine : appliqué dans la requête, pas à l'affichage
        ...(filters?.usine ? { store: { unite: filters.usine } } : {}),
        ...(filters?.q
          ? {
              OR: [
                { number: { contains: filters.q } },
                { description: { contains: filters.q } },
                { article: { code: { contains: filters.q } } },
                { article: { designation: { contains: filters.q } } },
              ],
            }
          : {}),
      },
      include: {
        article: true,
        store: true,
        createdBy: { select: { fullName: true } },
        productionLines: true,
      },
      orderBy: { createdAt: "desc" },
    });
  },

  /** Renvoie `null` si l'ordre existe mais appartient à une autre usine. */
  get(id: string, usine?: string | null) {
    return prisma.productionOrder.findFirst({
      where: { id, ...(usine ? { store: { unite: usine } } : {}) },
      include: {
        article: true,
        store: true,
        createdBy: { select: { fullName: true } },
        productionLines: { include: { enteredBy: { select: { fullName: true } } } },
        qualityControls: { include: { enteredBy: { select: { fullName: true } } } },
        nonConformities: true,
        comments: { include: { author: { select: { fullName: true } } }, orderBy: { createdAt: "desc" } },
      },
    });
  },

  async create(
    input: OrderCreateInput,
    userId: string,
    fullName?: string,
    usine?: string | null,
  ) {
    // Un utilisateur rattaché à une usine ne peut produire que pour son site
    if (usine) {
      const store = await prisma.store.findFirst({
        where: { id: input.storeId, unite: usine },
        select: { id: true },
      });
      if (!store) {
        throw new ApiError(403, `Magasin hors de votre périmètre (${usine})`);
      }
    }
    const number = await nextOrderNumber();
    // Un OF créé depuis le planning arrive déjà daté : il est donc planifié d'emblée.
    const planned = Boolean(input.dateDebut && input.dateFinPrev);
    const order = await prisma.productionOrder.create({
      data: {
        number,
        articleId: input.articleId,
        storeId: input.storeId,
        description: input.description,
        atelier: input.atelier?.trim() || null,
        equipe: input.equipe?.trim() || null,
        chefEquipe: input.chefEquipe?.trim() || null,
        dateDebut: input.dateDebut ? new Date(input.dateDebut) : null,
        dateFinPrev: input.dateFinPrev ? new Date(input.dateFinPrev) : null,
        observation: input.observation,
        priorite: input.priorite,
        plannedAt: planned ? new Date() : null,
        plannedBy: planned ? (fullName ?? null) : null,
        status: OrderStatus.IN_PRODUCTION,
        createdById: userId,
        productionLines: {
          create: { enteredById: userId, qtePrevue: input.qtePrevue },
        },
      },
    });
    await writeAudit({ userId, action: "CREATE", entity: "ProductionOrder", entityId: order.id, after: order });
    await notifyRole(Role.PRODUCTION_MANAGER, NotificationType.NEW_ORDER, "Nouvel OF", `L'ordre ${number} a été créé.`, `/orders/${order.id}`);
    return order;
  },

  /**
   * Planifie (ou replanifie) un OF : dates, affectation atelier/équipe, priorité.
   * Sans effet sur les données de production déjà saisies.
   */
  async plan(orderId: string, input: PlanningInput, userId: string, fullName: string, usine?: string | null) {
    await assertScope(orderId, usine);
    const order = await prisma.productionOrder.findUnique({ where: { id: orderId } });
    if (!order) throw new ApiError(404, "OF introuvable");
    if (order.status === OrderStatus.CLOSED || order.status === OrderStatus.CANCELLED) {
      throw new ApiError(409, "Un OF clôturé ou annulé ne peut plus être planifié");
    }

    const before = { ...order };
    const wasPlanned = Boolean(order.dateDebut && order.dateFinPrev);

    const updated = await prisma.productionOrder.update({
      where: { id: orderId },
      data: {
        dateDebut: input.dateDebut ? new Date(input.dateDebut) : null,
        dateFinPrev: input.dateFinPrev ? new Date(input.dateFinPrev) : null,
        atelier: input.atelier?.trim() || null,
        equipe: input.equipe?.trim() || null,
        chefEquipe: input.chefEquipe?.trim() || null,
        priorite: input.priorite,
        sequence: input.sequence,
        plannedAt: input.dateDebut ? new Date() : null,
        plannedBy: input.dateDebut ? fullName : null,
      },
    });

    await writeAudit({
      userId,
      action: wasPlanned ? "REPLAN" : "PLAN",
      entity: "ProductionOrder",
      entityId: orderId,
      before,
      after: updated,
    });

    // L'atelier concerné doit savoir qu'un ordre lui est affecté ou déplacé
    if (updated.dateDebut) {
      await notifyRole(
        Role.PRODUCTION,
        NotificationType.NEW_ORDER,
        wasPlanned ? "OF replanifié" : "OF planifié",
        `${order.number} — ${updated.atelier ?? "atelier non affecté"} du ${updated.dateDebut.toLocaleDateString("fr-FR")} au ${updated.dateFinPrev?.toLocaleDateString("fr-FR")}.`,
        `/orders/${orderId}`,
      );
    }
    return updated;
  },

  /** Saisie production — refusée si l'OF est verrouillé. */
  async saveProduction(orderId: string, input: ProductionInput, userId: string, usine?: string | null) {
    await assertScope(orderId, usine);
    const order = await prisma.productionOrder.findUnique({
      where: { id: orderId },
      include: { productionLines: true },
    });
    if (!order) throw new ApiError(404, "OF introuvable");
    if (order.status !== OrderStatus.IN_PRODUCTION && order.status !== OrderStatus.DRAFT) {
      throw new ApiError(409, "Données de production verrouillées après validation");
    }
    const line = order.productionLines[0];
    const before = { ...line };
    const updated = await prisma.productionLine.update({
      where: { id: line.id },
      data: {
        qtePrevue: input.qtePrevue,
        qteProduite: input.qteProduite,
        qteBonne: input.qteBonne,
        qteRebut: input.qteRebut,
        causeRebut: input.causeRebut,
        causeRebutCode: input.causeRebutCode,
        causeRebutM5: input.causeRebutM5,
        tempsMachine: input.tempsMachine,
        tempsOperateur: input.tempsOperateur,
        heureDebut: input.heureDebut ? new Date(input.heureDebut) : null,
        heureFin: input.heureFin ? new Date(input.heureFin) : null,
        commentaires: input.commentaires,
      },
    });
    await writeAudit({ userId, action: "UPDATE", entity: "ProductionLine", entityId: line.id, before, after: updated });
    return updated;
  },

  /** Valide la production: verrouille définitivement les lignes et notifie la Qualité. */
  async validateProduction(orderId: string, userId: string, fullName: string, usine?: string | null) {
    await assertScope(orderId, usine);
    const order = await prisma.productionOrder.findUnique({ where: { id: orderId } });
    if (!order) throw new ApiError(404, "OF introuvable");
    if (order.status !== OrderStatus.IN_PRODUCTION) {
      throw new ApiError(409, "L'OF n'est pas en production");
    }
    const [updated] = await prisma.$transaction([
      prisma.productionOrder.update({
        where: { id: orderId },
        data: {
          status: OrderStatus.PRODUCTION_VALIDATED,
          productionValidatedAt: new Date(),
          productionValidatedBy: fullName,
        },
      }),
      prisma.productionLine.updateMany({ where: { orderId }, data: { isLocked: true } }),
    ]);
    await writeAudit({ userId, action: "VALIDATE_PRODUCTION", entity: "ProductionOrder", entityId: orderId, after: updated });
    await notifyRole(Role.QUALITY, NotificationType.QUALITY_REQUESTED, "Contrôle qualité demandé", `L'OF ${order.number} attend un contrôle qualité.`, `/orders/${orderId}`);
    return updated;
  },

  /** Saisie/mise à jour du contrôle qualité (indépendant de la production). */
  async saveQuality(orderId: string, input: QualityInput, userId: string, usine?: string | null) {
    await assertScope(orderId, usine);
    const order = await prisma.productionOrder.findUnique({ where: { id: orderId } });
    if (!order) throw new ApiError(404, "OF introuvable");
    if (order.status === OrderStatus.IN_PRODUCTION || order.status === OrderStatus.DRAFT) {
      throw new ApiError(409, "La production doit d'abord être validée");
    }
    const existing = await prisma.qualityControl.findFirst({ where: { orderId } });
    const data = {
      controleur: input.controleur,
      qteControlee: input.qteControlee,
      qteConforme: input.qteConforme,
      qteNonConforme: input.qteNonConforme,
      longueur: input.longueur,
      largeur: input.largeur,
      hauteur: input.hauteur,
      poids: input.poids,
      resistance: input.resistance,
      aspect: input.aspect,
      couleur: input.couleur,
      humidite: input.humidite,
      commentaires: input.commentaires,
      decision: input.decision,
      heureControle: new Date(),
    };
    const control = existing
      ? await prisma.qualityControl.update({ where: { id: existing.id }, data })
      : await prisma.qualityControl.create({ data: { ...data, orderId, enteredById: userId } });

    await writeAudit({ userId, action: existing ? "UPDATE" : "CREATE", entity: "QualityControl", entityId: control.id, after: control });

    // Fiche de non-conformité automatique dès qu'une quantité est refusée
    if (input.qteNonConforme > 0 || input.decision === "NON_CONFORME") {
      await this.ensureNonConformity(
        orderId,
        order.articleId,
        userId,
        input.qteNonConforme,
      );
    }
    return control;
  },

  /**
   * Crée (ou met à jour) la fiche de non-conformité de l'OF.
   * La gravité découle de la part refusée sur la quantité contrôlée.
   */
  async ensureNonConformity(
    orderId: string,
    articleId: string,
    userId: string,
    quantite = 0,
  ) {
    const order = await prisma.productionOrder.findUnique({
      where: { id: orderId },
      include: { productionLines: true },
    });
    const produite = order?.productionLines.reduce((s, l) => s + l.qteProduite, 0) ?? 0;
    const part = produite > 0 ? (quantite / produite) * 100 : 0;
    const gravite = part > 20 ? "CRITIQUE" : part > 5 ? "MAJEURE" : "MINEURE";
    const nature =
      quantite > 0
        ? `${quantite} unité(s) refusée(s) au contrôle qualité`
        : "Produit non conforme au contrôle qualité";

    const existing = await prisma.nonConformity.findFirst({
      where: { orderId, status: { not: "CLOTUREE" } },
    });
    if (existing) {
      const updated = await prisma.nonConformity.update({
        where: { id: existing.id },
        data: { quantite, gravite, nature },
      });
      await writeAudit({ userId, action: "UPDATE", entity: "NonConformity", entityId: updated.id, before: existing, after: updated });
      return updated;
    }

    const year = new Date().getFullYear();
    const prefix = `NC-${year}-`;
    const last = await prisma.nonConformity.findFirst({
      where: { number: { startsWith: prefix } },
      orderBy: { number: "desc" },
    });
    const seq = last ? Number(last.number.slice(prefix.length)) + 1 : 1;
    const nc = await prisma.nonConformity.create({
      data: {
        number: `${prefix}${String(seq).padStart(4, "0")}`,
        orderId,
        articleId,
        nature,
        quantite,
        gravite,
      },
    });
    await writeAudit({ userId, action: "CREATE", entity: "NonConformity", entityId: nc.id, after: nc });
    await notifyRole(Role.PRODUCTION_MANAGER, NotificationType.ORDER_REJECTED, "Non-conformité détectée", `${nc.number} — ${nature}.`, `/non-conformities`);
    return nc;
  },

  async validateQuality(orderId: string, userId: string, fullName: string, usine?: string | null) {
    await assertScope(orderId, usine);
    const order = await prisma.productionOrder.findUnique({ where: { id: orderId }, include: { qualityControls: true } });
    if (!order) throw new ApiError(404, "OF introuvable");
    if (order.status !== OrderStatus.PRODUCTION_VALIDATED) {
      throw new ApiError(409, "La production doit être validée avant la qualité");
    }
    if (order.qualityControls.length === 0 || order.qualityControls.some((c) => c.decision === "EN_ATTENTE")) {
      throw new ApiError(409, "Le contrôle qualité doit être complété (aucune décision en attente)");
    }
    if (order.qualityControls.some((c) => c.qteControlee <= 0)) {
      throw new ApiError(
        409,
        "La quantité contrôlée doit être renseignée avant validation qualité",
      );
    }
    const updated = await prisma.$transaction(async (tx) => {
      await tx.qualityControl.updateMany({ where: { orderId }, data: { isLocked: true } });
      return tx.productionOrder.update({
        where: { id: orderId },
        data: { status: OrderStatus.QUALITY_VALIDATED, qualityValidatedAt: new Date(), qualityValidatedBy: fullName },
      });
    });
    await writeAudit({ userId, action: "VALIDATE_QUALITY", entity: "ProductionOrder", entityId: orderId, after: updated });
    await notifyRole(Role.PRODUCTION_MANAGER, NotificationType.VALIDATION_DONE, "Validation qualité", `L'OF ${order.number} est prêt à être clôturé.`, `/orders/${orderId}`);
    return updated;
  },

  async close(orderId: string, userId: string, fullName: string, usine?: string | null) {
    await assertScope(orderId, usine);
    const order = await prisma.productionOrder.findUnique({ where: { id: orderId } });
    if (!order) throw new ApiError(404, "OF introuvable");
    if (order.status !== OrderStatus.QUALITY_VALIDATED) {
      throw new ApiError(409, "La qualité doit être validée avant la clôture");
    }
    const updated = await prisma.productionOrder.update({
      where: { id: orderId },
      data: { status: OrderStatus.CLOSED, closedAt: new Date(), closedBy: fullName },
    });
    await writeAudit({ userId, action: "CLOSE", entity: "ProductionOrder", entityId: orderId, after: updated });
    await notifyRole(Role.PRODUCTION, NotificationType.ORDER_COMPLETED, "OF clôturé", `L'OF ${order.number} a été clôturé.`, `/orders/${orderId}`);
    return updated;
  },
};
