import { prisma } from "@/lib/prisma";
import { ApiError, handle, ok, requirePermission } from "@/lib/api";
import { writeAudit } from "@/lib/audit";
import { AUTRE_CATEGORY, M5_CATEGORIES } from "@/lib/default-reject-causes";
import { rejectCauseCreateSchema } from "@/lib/validations";

/** Ordonne les axes 5M d'abord, puis toute catégorie additionnelle. */
function trierCategories(categories: string[]) {
  const connues = M5_CATEGORIES as readonly string[];
  return categories.sort((a, b) => {
    const ia = connues.indexOf(a);
    const ib = connues.indexOf(b);
    return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib);
  });
}

/** Référentiel des causes de rebut, regroupées par axe 5M (Ishikawa). */
export async function GET() {
  return handle(async () => {
    await requirePermission("production:read");
    const causes = await prisma.rejectCause.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: "asc" },
      select: { code: true, label: true, category: true },
    });

    const categories = trierCategories(
      Array.from(new Set(causes.map((c) => c.category))),
    );

    return ok({
      categories,
      causes,
      groups: categories.map((category) => ({
        category,
        causes: causes.filter((c) => c.category === category),
      })),
    });
  });
}

/**
 * Enregistre une cause saisie en clair via l'option « Autre ».
 *
 * La cause rejoint définitivement le référentiel : sans cela, chaque saisie
 * libre repartirait de zéro et fragmenterait le Pareto des défauts, ce que
 * la liste fermée sert précisément à éviter. Une cause déjà connue est
 * réutilisée plutôt que dupliquée.
 */
export async function POST(req: Request) {
  return handle(async () => {
    const session = await requirePermission("production:write");
    const { label } = rejectCauseCreateSchema.parse(await req.json());

    // Rapprochement insensible à la casse : SQLite ne sachant pas le faire
    // sur des colonnes non ASCII, la comparaison se fait en mémoire — le
    // référentiel tient en quelques dizaines de lignes.
    const existantes = await prisma.rejectCause.findMany({
      select: { id: true, code: true, label: true, category: true, isActive: true },
    });
    const normaliser = (s: string) => s.trim().toLocaleLowerCase("fr");
    const deja = existantes.find((c) => normaliser(c.label) === normaliser(label));
    if (deja) {
      // Une cause désactivée que l'on ressaisit est réactivée
      if (!deja.isActive) {
        await prisma.rejectCause.update({
          where: { id: deja.id },
          data: { isActive: true },
        });
      }
      return ok({ code: deja.code, label: deja.label, category: deja.category });
    }

    // Code stable dérivé du libellé, préfixé par l'axe : « AU-COLLAGE »
    const base = label
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "") //     accents
      .toUpperCase()
      .replace(/[^A-Z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 20);
    if (!base) throw new ApiError(422, "Libellé de cause invalide");

    const pris = new Set(existantes.map((c) => c.code));
    let code = `AU-${base}`;
    for (let i = 2; pris.has(code); i++) code = `AU-${base}-${i}`;

    // Les causes libres se rangent après le référentiel 5M d'origine
    const dernier = await prisma.rejectCause.findFirst({
      where: { category: AUTRE_CATEGORY },
      orderBy: { sortOrder: "desc" },
      select: { sortOrder: true },
    });

    const cause = await prisma.rejectCause.create({
      data: {
        code,
        label: label.trim(),
        category: AUTRE_CATEGORY,
        sortOrder: Math.max(dernier?.sortOrder ?? 60, 60) + 1,
      },
    });

    await writeAudit({
      userId: session.sub,
      action: "CREATE",
      entity: "RejectCause",
      entityId: cause.id,
      after: cause,
    });

    return ok(
      { code: cause.code, label: cause.label, category: cause.category },
      201,
    );
  });
}
