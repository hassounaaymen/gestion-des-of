import { userService } from "@/services/user.service";
import { userCreateSchema } from "@/lib/validations";
import { handle, ok, requirePermission } from "@/lib/api";
import { rolesAttribuables, scopeUsine } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";

export async function GET() {
  return handle(async () => {
    const session = await requirePermission("user:manage");
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
      /** Usines disponibles ; réduites à la sienne pour un directeur d'usine */
      unites: scopeUsine(session)
        ? [scopeUsine(session)!]
        : unites.map((u) => u.unite!).filter(Boolean),
      scope: scopeUsine(session),
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
