/**
 * Extraction des cotes nominales à partir des désignations ERP.
 *
 * Le référentiel Best Béton encode les dimensions dans le libellé article :
 *   "BLOC Creux 10X20X40 cm"          → 100 × 200 × 400 mm
 *   "AGGLOS 20X20X50 A6"              → 200 × 200 × 500 mm  (cm implicite)
 *   "DALOT 1.5X1.5 SC HR 60 CM"       → 1500 × 1500 mm      (m implicite)
 *   "BORDURE CANIVEAUX 1M"            → longueur 1000 mm
 *
 * Ces cotes servent de référence au contrôle dimensionnel : la tolérance
 * de la famille s'applique autour de cette valeur nominale.
 */

export interface NominalDimensions {
  /** Cotes en millimètres (longueur = plus grande, hauteur = plus petite) */
  longueur?: number;
  largeur?: number;
  hauteur?: number;
  /** Chaîne brute reconnue, pour affichage */
  raw?: string;
}

const NUM = "\\d+(?:[.,]\\d+)?";

function toNumber(s: string) {
  return Number(s.replace(",", "."));
}

const FACTORS = { mm: 1, cm: 10, m: 1000 } as const;
type Unit = keyof typeof FACTORS;

/**
 * Détermine l'unité d'une cote.
 * 1) unité explicite accolée à la cote (ex. "10X20X40 cm") ;
 * 2) à défaut, inférence par ordre de grandeur — les libellés du référentiel
 *    expriment les grands ouvrages en mètres et les blocs en centimètres.
 */
function resolveUnit(text: string, matchEnd: number, values: number[]): Unit {
  const trailing = text.slice(matchEnd, matchEnd + 6).toUpperCase();
  const explicit = /^\s*(MM|CM|ML|M)\b/.exec(trailing);
  if (explicit) {
    const u = explicit[1];
    if (u === "MM") return "mm";
    if (u === "CM") return "cm";
    return "m"; // M / ML
  }
  const max = Math.max(...values);
  if (max < 10) return "m"; //     ex. dalots 1.5 × 1.5
  if (max <= 250) return "cm"; //  ex. blocs 20 × 20 × 50
  return "mm"; //                  déjà exprimé en millimètres
}

/** Analyse une désignation et renvoie les cotes nominales en millimètres. */
export function parseNominalDimensions(designation: string): NominalDimensions | null {
  if (!designation) return null;
  const text = designation.trim();

  // Format A × B × C
  const three = new RegExp(`(${NUM})\\s*[xX*]\\s*(${NUM})\\s*[xX*]\\s*(${NUM})`).exec(text);
  if (three) {
    const values = [toNumber(three[1]), toNumber(three[2]), toNumber(three[3])];
    const factor = FACTORS[resolveUnit(text, three.index + three[0].length, values)];
    const sorted = values.map((v) => v * factor).sort((a, b) => b - a);
    return { longueur: sorted[0], largeur: sorted[1], hauteur: sorted[2], raw: three[0] };
  }

  // Format A × B
  const two = new RegExp(`(${NUM})\\s*[xX*]\\s*(${NUM})`).exec(text);
  if (two) {
    const values = [toNumber(two[1]), toNumber(two[2])];
    const factor = FACTORS[resolveUnit(text, two.index + two[0].length, values)];
    const sorted = values.map((v) => v * factor).sort((a, b) => b - a);
    return { longueur: sorted[0], largeur: sorted[1], raw: two[0] };
  }

  // Diamètre seul : "Ø300", "DN 400"
  const diam = new RegExp(`(?:Ø|DN\\s*|DIAM\\s*)(${NUM})`, "i").exec(text);
  if (diam) {
    const v = toNumber(diam[1]);
    const factor = FACTORS[resolveUnit(text, diam.index + diam[0].length, [v])];
    return { largeur: v * factor, raw: diam[0] };
  }

  // Longueur seule avec unité explicite : "1M", "2,5 ML", "50 CM"
  const len = new RegExp(`(${NUM})\\s*(ML|M|CM|MM)\\b`, "i").exec(text);
  if (len) {
    const u = len[2].toUpperCase();
    const factor = u === "MM" ? FACTORS.mm : u === "CM" ? FACTORS.cm : FACTORS.m;
    return { longueur: toNumber(len[1]) * factor, raw: len[0] };
  }

  return null;
}

/** Formate une cote en millimètres pour l'affichage. */
export function formatMm(value?: number | null) {
  if (value === null || value === undefined) return "—";
  return `${new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 1 }).format(value)} mm`;
}
