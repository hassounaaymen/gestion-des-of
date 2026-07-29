import { prisma } from "@/lib/prisma";
import { handle, ok, requirePermission } from "@/lib/api";
import type { Prisma } from "@prisma/client";

export async function GET(req: Request) {
  return handle(async () => {
    await requirePermission("erp:read");
    const sp = new URL(req.url).searchParams;
    const q = sp.get("q")?.trim();
    const family = sp.get("family")?.trim();
    const line = sp.get("line")?.trim();
    // Par défaut, la recherche d'un OF ne porte que sur les articles fabricables
    const manufacturedOnly = sp.get("manufactured") === "1";
    const take = Math.min(Number(sp.get("take") ?? 50), 200);

    const where: Prisma.ArticleWhereInput = {
      ...(manufacturedOnly ? { isManufactured: true } : {}),
      ...(family ? { family } : {}),
      ...(line ? { productionLine: line } : {}),
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
