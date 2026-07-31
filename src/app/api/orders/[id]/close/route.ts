import { orderService } from "@/services/order.service";
import { handle, ok, requirePermission } from "@/lib/api";

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const session = await requirePermission("order:close");
    const { id } = await params;
    const order = await orderService.close(id, session.sub, session.fullName, session.usine);
    return ok(order);
  });
}
