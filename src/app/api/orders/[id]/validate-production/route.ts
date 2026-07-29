import { orderService } from "@/services/order.service";
import { handle, ok, requirePermission } from "@/lib/api";

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const session = await requirePermission("order:validateProduction");
    const { id } = await params;
    const order = await orderService.validateProduction(id, session.sub, session.fullName);
    return ok(order);
  });
}
