import { SpecMode } from "@prisma/client";

/**
 * Plans de contrôle par défaut, par famille de produit.
 *
 * Les seuils s'appuient sur les référentiels usuels du béton préfabriqué :
 *  - EN 771-3   blocs de béton (agglos)
 *  - EN 1338/1339/1340  pavés, dalles, bordures
 *  - EN 1916/1917  tuyaux et regards
 *  - EN 1168    dalles alvéolées
 *  - EN 15037   poutrelles précontraintes
 *  - EN 14844   dalots / cadres
 *
 * Ils constituent une base de départ : le Responsable Qualité peut les ajuster.
 * `family: "*"` sert de plan générique de repli.
 */

export interface SpecSeed {
  family: string;
  parameter: string;
  label: string;
  unit: string | null;
  mode: SpecMode;
  tolerance?: number | null;
  minValue?: number | null;
  maxValue?: number | null;
  isCritical?: boolean;
  sortOrder: number;
}

/** Génère les 3 points de contrôle dimensionnels d'une famille. */
function dimensions(family: string, tolerance: number): SpecSeed[] {
  return [
    { family, parameter: "longueur", label: "Longueur", unit: "mm", mode: SpecMode.TOLERANCE, tolerance, sortOrder: 1 },
    { family, parameter: "largeur", label: "Largeur", unit: "mm", mode: SpecMode.TOLERANCE, tolerance, sortOrder: 2 },
    { family, parameter: "hauteur", label: "Hauteur / Épaisseur", unit: "mm", mode: SpecMode.TOLERANCE, tolerance, sortOrder: 3 },
  ];
}

function resistance(family: string, min: number, critical = true): SpecSeed {
  return {
    family,
    parameter: "resistance",
    label: "Résistance à la compression",
    unit: "MPa",
    mode: SpecMode.RANGE,
    minValue: min,
    isCritical: critical,
    sortOrder: 4,
  };
}

function humidite(family: string, max: number): SpecSeed {
  return {
    family,
    parameter: "humidite",
    label: "Humidité",
    unit: "%",
    mode: SpecMode.RANGE,
    maxValue: max,
    sortOrder: 5,
  };
}

/** Famille → (tolérance dimensionnelle mm, résistance mini MPa, humidité maxi %) */
const PLANS: Record<string, { tol: number; res: number; hum: number }> = {
  "PRODUIT VIBRE": { tol: 3, res: 4, hum: 10 },
  DALOT: { tol: 5, res: 30, hum: 8 },
  REGARD: { tol: 5, res: 30, hum: 8 },
  "DALLE REGARD": { tol: 5, res: 30, hum: 8 },
  TUYAU: { tol: 5, res: 30, hum: 8 },
  REHAUSSE: { tol: 5, res: 25, hum: 8 },
  "MUR ALVEOLE": { tol: 5, res: 25, hum: 8 },
  MC: { tol: 5, res: 25, hum: 10 },
  POUTRELLE: { tol: 10, res: 40, hum: 6 },
  "DALLE ALVEOLE": { tol: 10, res: 45, hum: 6 },
  "PRE DALLE": { tol: 10, res: 30, hum: 6 },
  "POUTRE-CHARPENTE": { tol: 10, res: 35, hum: 6 },
  POTEAU: { tol: 10, res: 35, hum: 6 },
  PANNE: { tol: 10, res: 35, hum: 6 },
  SEMELLE: { tol: 10, res: 30, hum: 8 },
  SF: { tol: 5, res: 25, hum: 8 },
  "*": { tol: 5, res: 25, hum: 8 },
};

export const DEFAULT_QUALITY_SPECS: SpecSeed[] = Object.entries(PLANS).flatMap(
  ([family, { tol, res, hum }]) => [
    ...dimensions(family, tol),
    resistance(family, res),
    humidite(family, hum),
  ],
);
