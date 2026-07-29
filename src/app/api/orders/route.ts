import { orderService } from "@/services/order.service";
import { orderCreateSchema } from "@/lib/validations";
import { handle, ok, requirePermission } from "@/lib/api";
import type { OrderStatus } from "@prisma/client";

export async function GET(req: Request) {
  return handle(async () => {
    await requirePermission("order:read");
    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status") as OrderStatus | null;
    const q = searchParams.get("q") ?? undefined;
    const orders = await orderService.list({ status: status ?? undefined, q });
    return ok(orders);
  });
}

export async function POST(req: Request) {
  return handle(async () => {
    const session = await requirePermission("order:create");
    const input = orderCreateSchema.parse(await req.json());
    const order = await orderService.create(input, session.sub, session.fullName);
    return ok(order, 201);
  });
}
