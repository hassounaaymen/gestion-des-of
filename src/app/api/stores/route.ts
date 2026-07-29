import { prisma } from "@/lib/prisma";
import { handle, ok, requirePermission } from "@/lib/api";
import type { Prisma, StoreType } from "@prisma/client";

export async function GET(req: Request) {
  return handle(async () => {
    await requirePermission("erp:read");
    const sp = new URL(req.url).searchParams;
    const q = sp.get("q")?.trim();
    const type = sp.get("type")?.trim() as StoreType | undefined;

    const where: Prisma.StoreWhereInput = {
      ...(type ? { type } : {}),
      ...(q ? { OR: [{ code: { contains: q } }, { designation: { contains: q } }] } : {}),
    };

    const stores = await prisma.store.findMany({ where, orderBy: { code: "asc" } });
    return ok(stores);
  });
}
