/**
 * Évaluation des mesures qualité contre le plan de contrôle.
 * Module pur (sans accès base) : partagé serveur ↔ client pour offrir
 * un retour de conformité immédiat au contrôleur pendant la saisie.
 */

export type Verdict = "OK" | "HORS_TOLERANCE" | "NON_MESURE";

export interface ControlPoint {
  parameter: string;
  label: string;
  unit: string | null;
  isCritical: boolean;
  /** Cote nominale attendue (déduite de la désignation ERP) */
  nominal: number | null;
  min: number | null;
  max: number | null;
}

export interface EvaluatedPoint extends ControlPoint {
  value: number | null;
  verdict: Verdict;
  deviation: number | null;
}

export interface QualityEvaluation {
  points: EvaluatedPoint[];
  measured: number;
  total: number;
  failures: EvaluatedPoint[];
  criticalFailures: EvaluatedPoint[];
  suggestedDecision: "CONFORME" | "NON_CONFORME" | "EN_ATTENTE";
}

/** Évalue une valeur mesurée contre son point de contrôle. */
export function evaluatePoint(
  point: ControlPoint,
  value: number | null | undefined,
): EvaluatedPoint {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return { ...point, value: null, verdict: "NON_MESURE", deviation: null };
  }
  const below = point.min !== null && value < point.min;
  const above = point.max !== null && value > point.max;
  const hasBounds = point.min !== null || point.max !== null;

  return {
    ...point,
    value,
    verdict: !hasBounds ? "OK" : below || above ? "HORS_TOLERANCE" : "OK",
    deviation: point.nominal !== null ? value - point.nominal : null,
  };
}

/** Évalue l'ensemble du plan et propose une décision. */
export function evaluatePlan(
  plan: ControlPoint[],
  measures: Record<string, number | null | undefined>,
): QualityEvaluation {
  const points = plan.map((p) => evaluatePoint(p, measures[p.parameter]));
  const measured = points.filter((p) => p.verdict !== "NON_MESURE").length;
  const failures = points.filter((p) => p.verdict === "HORS_TOLERANCE");
  const criticalFailures = failures.filter((p) => p.isCritical);

  let suggestedDecision: QualityEvaluation["suggestedDecision"] = "EN_ATTENTE";
  if (failures.length > 0) {
    suggestedDecision = "NON_CONFORME";
  } else if (measured > 0 && measured === points.length) {
    suggestedDecision = "CONFORME";
  }

  return { points, measured, total: points.length, failures, criticalFailures, suggestedDecision };
}

/** Formate la plage de tolérance d'un point de contrôle. */
export function formatRange(point: ControlPoint): string {
  const fmt = (n: number) =>
    new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 1 }).format(n);
  const u = point.unit ? ` ${point.unit}` : "";
  if (point.min !== null && point.max !== null) return `${fmt(point.min)} – ${fmt(point.max)}${u}`;
  if (point.min !== null) return `≥ ${fmt(point.min)}${u}`;
  if (point.max !== null) return `≤ ${fmt(point.max)}${u}`;
  return "Informatif";
}
