import { prisma } from "@/lib/prisma";
import { handle, ok, requirePermission } from "@/lib/api";
import { M5_CATEGORIES } from "@/lib/default-reject-causes";

/** Référentiel des causes de rebut, regroupées par axe 5M (Ishikawa). */
export async function GET() {
  return handle(async () => {
    await requirePermission("production:read");
    const causes = await prisma.rejectCause.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: "asc" },
      select: { code: true, label: true, category: true },
    });

    // Ordre des axes 5M d'abord, puis toute catégorie additionnelle
    const known = M5_CATEGORIES as readonly string[];
    const categories = Array.from(new Set(causes.map((c) => c.category))).sort((a, b) => {
      const ia = known.indexOf(a);
      const ib = known.indexOf(b);
      return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib);
    });

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
