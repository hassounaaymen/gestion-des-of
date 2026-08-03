import { prisma } from "@/lib/prisma";
import { handle, ok, requirePermission } from "@/lib/api";
import { can, scopeUsines } from "@/lib/rbac";
import type { Prisma } from "@prisma/client";

export async function GET(req: Request) {
  return handle(async () => {
    const session = await requirePermission("erp:read");
    const sp = new URL(req.url).searchParams;
    const q = sp.get("q")?.trim();
    const family = sp.get("family")?.trim();
    const line = sp.get("line")?.trim();
    // Par défaut, la recherche d'un OF ne porte que sur les articles fabricables
    const manufacturedOnly = sp.get("manufactured") === "1";
    const take = Math.min(Number(sp.get("take") ?? 50), 200);

    /**
     * Rattachement d'un article à une usine : sa ligne de production, déduite
     * du groupe compta produit de l'ERP (« PF-QUADRA » → « QUADRA »).
     *
     * Un article sans ligne ne relève d'aucune usine et ne peut donc pas faire
     * l'objet d'un OF : on l'écarte partout, sauf dans le référentiel brut
     * (`erp:browse`, réservé à l'administrateur), qui doit justement permettre
     * de repérer ces articles mal catégorisés dans l'ERP.
     */
    const usines = scopeUsines(session);
    const rattachementRequis = manufacturedOnly || !can(session.role, "erp:browse");

    // Le filtre « ligne » de l'écran ne peut que restreindre le périmètre :
    // une ligne hors périmètre ne renvoie rien plutôt que d'être ignorée.
    let productionLine: Prisma.ArticleWhereInput["productionLine"];
    if (line) {
      productionLine = !usines || usines.includes(line) ? line : { in: [] };
    } else if (usines) {
      productionLine = { in: usines };
    } else if (rattachementRequis) {
      productionLine = { not: null };
    }

    const where: Prisma.ArticleWhereInput = {
      // Cloisonnement appliqué dans la requête, pas à l'affichage
      ...(productionLine !== undefined ? { productionLine } : {}),
      ...(manufacturedOnly ? { isManufactured: true } : {}),
      ...(family ? { family } : {}),
      ...(q
        ? {
            OR: [
              { code: { contains: q } },
              { designation: { contains: q } },
              { family: { contains: q } },
            ],
          }
        : {}),
    };

    const [items, total] = await Promise.all([
      prisma.article.findMany({
        where,
        orderBy: [{ isManufactured: "desc" }, { code: "asc" }],
        take,
      }),
      prisma.article.count({ where }),
    ]);

    return ok({ items, total, returned: items.length });
  });
}
