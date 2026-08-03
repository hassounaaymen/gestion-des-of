import { scopeUsines } from "@/lib/rbac";
import { orderService } from "@/services/order.service";
import { planningSchema } from "@/lib/validations";
import { handle, ok, requirePermission } from "@/lib/api";

/** Planifie ou replanifie un ordre de fabrication. */
export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const session = await requirePermission("planning:write");
    const { id } = await params;
    const input = planningSchema.parse(await req.json());
    const order = await orderService.plan(id, input, session.sub, session.fullName, scopeUsines(session));
    return ok(order);
  });
}
