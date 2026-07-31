import { z } from "zod";

/** Chaîne facultative : accepte "", null et undefined. */
const optionalString = z.string().nullish();
/** Nombre facultatif : accepte null / undefined sans coercition vers 0. */
const optionalNumber = z.coerce.number().nullish();
/** Date ISO facultative. */
const optionalDate = z.union([z.string().datetime(), z.literal("")]).nullish();

// ── Auth ──────────────────────────────────────────────
export const loginSchema = z.object({
  identifier: z.string().min(1, "Identifiant requis"), // username ou email
  password: z.string().min(1, "Mot de passe requis"),
});
export type LoginInput = z.infer<typeof loginSchema>;

// ── Comptes utilisateurs ──────────────────────────────
const ROLES = [
  "SUPER_ADMIN", "DIRECTION", "DIRECTEUR_USINE",
  "PRODUCTION", "QUALITY", "PRODUCTION_MANAGER", "VIEWER",
] as const;

const motDePasse = z
  .string()
  .min(8, "8 caractères minimum")
  .regex(/[A-Za-z]/, "Doit contenir une lettre")
  .regex(/[0-9]/, "Doit contenir un chiffre");

export const userCreateSchema = z.object({
  username: z
    .string()
    .min(3, "3 caractères minimum")
    .regex(/^[a-zA-Z0-9._-]+$/, "Lettres, chiffres, point, tiret et souligné uniquement"),
  email: z.string().email("Adresse e-mail invalide"),
  fullName: z.string().min(2, "Nom complet requis"),
  role: z.enum(ROLES),
  usine: optionalString,
  password: motDePasse,
});
export type UserCreateInput = z.infer<typeof userCreateSchema>;

export const userUpdateSchema = z.object({
  email: z.string().email("Adresse e-mail invalide").optional(),
  fullName: z.string().min(2).optional(),
  role: z.enum(ROLES).optional(),
  usine: optionalString,
  isActive: z.boolean().optional(),
  /** Renseigné uniquement lors d'une réinitialisation */
  password: motDePasse.optional(),
});
export type UserUpdateInput = z.infer<typeof userUpdateSchema>;

// ── Ordre de fabrication ──────────────────────────────
export const orderCreateSchema = z
  .object({
    articleId: z.string().min(1, "Article requis"),
    storeId: z.string().min(1, "Magasin requis"),
    description: optionalString,
    atelier: optionalString,
    equipe: optionalString,
    chefEquipe: optionalString,
    dateDebut: optionalDate,
    dateFinPrev: optionalDate,
    observation: optionalString,
    /** Quantité à fabriquer — initialise la ligne de production */
    qtePrevue: z.coerce.number().min(0).default(0),
    priorite: z.enum(["BASSE", "NORMALE", "HAUTE", "URGENTE"]).default("NORMALE"),
  })
  .refine(
    (d) =>
      !d.dateDebut || !d.dateFinPrev ||
      new Date(d.dateFinPrev).getTime() >= new Date(d.dateDebut).getTime(),
    {
      message: "La date de fin prévue doit être postérieure ou égale à la date de début",
      path: ["dateFinPrev"],
    },
  );
export type OrderCreateInput = z.infer<typeof orderCreateSchema>;

// ── Planification d'un OF ─────────────────────────────
export const planningSchema = z
  .object({
    dateDebut: optionalDate,
    dateFinPrev: optionalDate,
    atelier: optionalString,
    equipe: optionalString,
    chefEquipe: optionalString,
    priorite: z.enum(["BASSE", "NORMALE", "HAUTE", "URGENTE"]).default("NORMALE"),
    sequence: z.coerce.number().int().min(0).default(0),
  })
  // Une fin prévue antérieure au début rendrait la charge d'atelier incohérente.
  .refine(
    (d) =>
      !d.dateDebut || !d.dateFinPrev ||
      new Date(d.dateFinPrev).getTime() >= new Date(d.dateDebut).getTime(),
    {
      message: "La date de fin prévue doit être postérieure ou égale à la date de début",
      path: ["dateFinPrev"],
    },
  )
  // Planifier suppose de dater : les deux bornes vont de pair.
  .refine((d) => Boolean(d.dateDebut) === Boolean(d.dateFinPrev), {
    message: "Renseignez la date de début et la date de fin prévue",
    path: ["dateFinPrev"],
  });
export type PlanningInput = z.infer<typeof planningSchema>;

// ── Saisie production ─────────────────────────────────
export const productionSchema = z
  .object({
    qtePrevue: z.coerce.number().min(0).default(0),
    qteProduite: z.coerce.number().min(0).default(0),
    qteBonne: z.coerce.number().min(0).default(0),
    qteRebut: z.coerce.number().min(0).default(0),
    causeRebut: optionalString,
    causeRebutCode: optionalString,
    causeRebutM5: optionalString,
    tempsMachine: optionalNumber,
    tempsOperateur: optionalNumber,
    heureDebut: optionalDate,
    heureFin: optionalDate,
    commentaires: optionalString,
  })
  // Cohérence industrielle : le produit se répartit entre bon et rebut.
  .refine((d) => Math.abs(d.qteBonne + d.qteRebut - d.qteProduite) < 0.001, {
    message: "Incohérence : quantité bonne + rebut doit égaler la quantité produite",
    path: ["qteProduite"],
  })
  // Un rebut constaté doit être motivé par une cause du référentiel 5M.
  .refine((d) => d.qteRebut === 0 || Boolean(d.causeRebutCode?.trim()), {
    message: "La cause du rebut est obligatoire dès qu'une quantité rebut est saisie",
    path: ["causeRebutCode"],
  });
export type ProductionInput = z.infer<typeof productionSchema>;

// ── Contrôle qualité ──────────────────────────────────
export const qualitySchema = z
  .object({
    controleur: optionalString,
    // Validation quantitative
    qteControlee: z.coerce.number().min(0).default(0),
    qteConforme: z.coerce.number().min(0).default(0),
    qteNonConforme: z.coerce.number().min(0).default(0),
    // Mesures
    longueur: optionalNumber,
    largeur: optionalNumber,
    hauteur: optionalNumber,
    poids: optionalNumber,
    resistance: optionalNumber,
    aspect: optionalString,
    couleur: optionalString,
    humidite: optionalNumber,
    commentaires: optionalString,
    decision: z
      .enum(["CONFORME", "PARTIEL", "NON_CONFORME", "EN_ATTENTE"])
      .default("EN_ATTENTE"),
  })
  // Cohérence du contrôle : conforme + non conforme = quantité contrôlée.
  .refine(
    (d) => Math.abs(d.qteConforme + d.qteNonConforme - d.qteControlee) < 0.001,
    {
      message:
        "Incohérence : quantité conforme + non conforme doit égaler la quantité contrôlée",
      path: ["qteControlee"],
    },
  );
export type QualityInput = z.infer<typeof qualitySchema>;

// ── Non-conformité ────────────────────────────────────
export const ncSchema = z.object({
  orderId: z.string().min(1),
  articleId: z.string().min(1),
  nature: optionalString,
  gravite: z.enum(["MINEURE", "MAJEURE", "CRITIQUE"]).default("MINEURE"),
  cause: optionalString,
  actionCorrective: optionalString,
  responsableId: optionalString,
  status: z.enum(["OUVERTE", "EN_COURS", "RESOLUE", "CLOTUREE"]).default("OUVERTE"),
});
export type NcInput = z.infer<typeof ncSchema>;
