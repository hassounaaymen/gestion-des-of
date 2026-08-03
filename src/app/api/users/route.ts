import { userService } from "@/services/user.service";
import { userCreateSchema } from "@/lib/validations";
import { handle, ok, requirePermission } from "@/lib/api";
import { rolesAttribuables, scopeUsines } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";

export async function GET() {
  return handle(async () => {
    const session = await requirePermission("user:manage");
    const portee = scopeUsines(session);
    const [users, unites] = await Promise.all([
      userService.list(session),
      prisma.store.findMany({
        where: { unite: { not: null } },
        distinct: ["unite"],
        select: { unite: true },
        orderBy: { unite: "asc" },
      }),
    ]);

    return ok({
      users,
      /** Rôles que l'appelant a le droit d'attribuer */
      roles: rolesAttribuables(session.role),
      /** Usines attribuables ; réduites à son périmètre pour un directeur */
      unites: portee ?? unites.map((u) => u.unite!).filter(Boolean),
      /**
       * Périmètre de l'appelant : `null` = toutes les usines, seul cas où
       * il peut accorder « Toutes les usines » à un compte.
       */
      scope: portee,
    });
  });
}

export async function POST(req: Request) {
  return handle(async () => {
    const session = await requirePermission("user:manage");
    const input = userCreateSchema.parse(await req.json());
    const user = await userService.create(session, input);
    return ok(user, 201);
  });
}
