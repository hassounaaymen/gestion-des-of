import type {
  OrderStatus,
  QualityDecision,
  NcStatus,
  NcGravite,
} from "@prisma/client";

type Variant = "default" | "secondary" | "success" | "warning" | "destructive" | "outline";

export const ORDER_STATUS: Record<OrderStatus, { label: string; variant: Variant }> = {
  DRAFT: { label: "Brouillon", variant: "secondary" },
  IN_PRODUCTION: { label: "En production", variant: "default" },
  PRODUCTION_VALIDATED: { label: "Production validée", variant: "warning" },
  QUALITY_VALIDATED: { label: "Qualité validée", variant: "success" },
  CLOSED: { label: "Clôturé", variant: "outline" },
  CANCELLED: { label: "Annulé", variant: "destructive" },
};

export const QUALITY_DECISION: Record<QualityDecision, { label: string; variant: Variant }> = {
  CONFORME: { label: "Conforme", variant: "success" },
  PARTIEL: { label: "Conforme partiel", variant: "warning" },
  NON_CONFORME: { label: "Non conforme", variant: "destructive" },
  EN_ATTENTE: { label: "En attente", variant: "warning" },
};

export const NC_STATUS: Record<NcStatus, { label: string; variant: Variant }> = {
  OUVERTE: { label: "Ouverte", variant: "destructive" },
  EN_COURS: { label: "En cours", variant: "warning" },
  RESOLUE: { label: "Résolue", variant: "default" },
  CLOTUREE: { label: "Clôturée", variant: "success" },
};

export const NC_GRAVITE: Record<NcGravite, { label: string; variant: Variant }> = {
  MINEURE: { label: "Mineure", variant: "secondary" },
  MAJEURE: { label: "Majeure", variant: "warning" },
  CRITIQUE: { label: "Critique", variant: "destructive" },
};
