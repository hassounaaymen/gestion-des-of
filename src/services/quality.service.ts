import { prisma } from "@/lib/prisma";
import { SpecMode, type QualitySpec } from "@prisma/client";
import { parseNominalDimensions } from "@/lib/dimensions";
import type { ControlPoint } from "@/lib/quality-eval";

export * from "@/lib/quality-eval";

/**
 * Construit le plan de contrôle d'un article :
 * specs de sa famille + cotes nominales extraites de sa désignation ERP.
 */
export function buildControlPlan(
  specs: QualitySpec[],
  articleDesignation: string,
): ControlPoint[] {
  const nominal = parseNominalDimensions(articleDesignation);

  return specs
    .slice()
    .sort((a, b) => a.sortOrder - b.sortOrder || a.label.localeCompare(b.label))
    .map((spec) => {
      let min = spec.minValue;
      let max = spec.maxValue;
      let nom: number | null = null;

      if (spec.mode === SpecMode.TOLERANCE) {
        nom = (nominal?.[spec.parameter as keyof typeof nominal] ?? null) as number | null;
        if (typeof nom === "number" && spec.tolerance !== null) {
          min = nom - spec.tolerance;
          max = nom + spec.tolerance;
        } else {
          // Sans cote nominale exploitable, le point reste informatif
          nom = null;
          min = null;
          max = null;
        }
      }

      return {
        parameter: spec.parameter,
        label: spec.label,
        unit: spec.unit,
        isCritical: spec.isCritical,
        nominal: nom,
        min,
        max,
      };
    });
}

/** Charge le plan de contrôle applicable à un article (par sa famille, repli générique). */
export async function getControlPlanForArticle(article: {
  family: string | null;
  designation: string;
}): Promise<ControlPoint[]> {
  const specs = await prisma.qualitySpec.findMany({
    where: { family: article.family ?? "__none__" },
  });
  const effective =
    specs.length > 0 ? specs : await prisma.qualitySpec.findMany({ where: { family: "*" } });
  return buildControlPlan(effective, article.designation);
}
