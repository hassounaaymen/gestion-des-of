/**
 * Causes de rebut normalisées, classées selon les **5M** (diagramme d'Ishikawa) :
 * Main d'œuvre · Matière · Matériel · Méthode · Milieu.
 *
 * Une liste fermée garantit un Pareto exploitable (le texte libre fragmente
 * les catégories) et l'axe 5M permet de remonter à la cause racine.
 * Le référentiel est en base : ajustable sans redéploiement.
 */

/** Les 5 axes d'Ishikawa, dans l'ordre d'affichage. */
export const M5_CATEGORIES = [
  "Main d'œuvre",
  "Matière",
  "Matériel",
  "Méthode",
  "Milieu",
] as const;

export type M5Category = (typeof M5_CATEGORIES)[number];

export interface RejectCauseSeed {
  code: string;
  label: string;
  category: M5Category;
  sortOrder: number;
}

export const DEFAULT_REJECT_CAUSES: RejectCauseSeed[] = [
  // ── Main d'œuvre ────────────────────────────────────
  { code: "MO-MANIP", label: "Erreur de manipulation", category: "Main d'œuvre", sortOrder: 11 },
  { code: "MO-MODOP", label: "Non-respect du mode opératoire", category: "Main d'œuvre", sortOrder: 12 },
  { code: "MO-FORM", label: "Manque de formation / qualification", category: "Main d'œuvre", sortOrder: 13 },

  // ── Matière ─────────────────────────────────────────
  { code: "MA-DOSAGE", label: "Dosage béton non conforme", category: "Matière", sortOrder: 21 },
  { code: "MA-GRANU", label: "Granulats hors spécification", category: "Matière", sortOrder: 22 },
  { code: "MA-CIMENT", label: "Ciment / adjuvant défectueux", category: "Matière", sortOrder: 23 },
  { code: "MA-ACIER", label: "Ferraillage non conforme", category: "Matière", sortOrder: 24 },

  // ── Matériel ────────────────────────────────────────
  { code: "MT-MOULE", label: "Moule usé ou déformé", category: "Matériel", sortOrder: 31 },
  { code: "MT-PANNE", label: "Panne / dérèglement machine", category: "Matériel", sortOrder: 32 },
  { code: "MT-VIBR", label: "Défaut de vibration / compactage", category: "Matériel", sortOrder: 33 },
  { code: "MT-BANC", label: "Défaut du banc de précontrainte", category: "Matériel", sortOrder: 34 },

  // ── Méthode ─────────────────────────────────────────
  { code: "ME-DEMOUL", label: "Démoulage prématuré", category: "Méthode", sortOrder: 41 },
  { code: "ME-CURE", label: "Cure / étuvage insuffisant", category: "Méthode", sortOrder: 42 },
  { code: "ME-REGLAGE", label: "Erreur de réglage / paramétrage", category: "Méthode", sortOrder: 43 },
  { code: "ME-PRISE", label: "Non-respect du temps de prise", category: "Méthode", sortOrder: 44 },

  // ── Milieu ──────────────────────────────────────────
  { code: "MI-TEMP", label: "Température ambiante défavorable", category: "Milieu", sortOrder: 51 },
  { code: "MI-INTEMP", label: "Humidité / intempéries", category: "Milieu", sortOrder: 52 },
  { code: "MI-STOCK", label: "Manutention / stockage inadapté", category: "Milieu", sortOrder: 53 },
];
