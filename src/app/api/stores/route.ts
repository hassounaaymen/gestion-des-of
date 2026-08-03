import { prisma } from "@/lib/prisma";
import { handle, ok, requirePermission } from "@/lib/api";
import { storeScope } from "@/lib/scope";
import type { Prisma, StoreType } from "@prisma/client";

export async function GET(req: Request) {
  return handle(async () => {
    const session = await requirePermission("erp:read");
    const sp = new URL(req.url).searchParams;
    const q = sp.get("q")?.trim();
    const type = sp.get("type")?.trim() as StoreType | undefined;

    const where: Prisma.StoreWhereInput = {
      // Cloisonnement : le sélecteur de magasin d'un OF ne doit proposer que
      // les magasins du périmètre, que la création refuserait de toute façon.
      ...storeScope(session),
      ...(type ? { type } : {}),
      ...(q ? { OR: [{ code: { contains: q } }, { designation: { contains: q } }] } : {}),
    };

    const stores = await prisma.store.findMany({ where, orderBy: { code: "asc" } });
    return ok(stores);
  });
}
