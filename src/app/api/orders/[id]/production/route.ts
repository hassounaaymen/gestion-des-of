import { orderService } from "@/services/order.service";
import { productionSchema } from "@/lib/validations";
import { handle, ok, requirePermission } from "@/lib/api";

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const session = await requirePermission("production:write");
    const { id } = await params;
    const input = productionSchema.parse(await req.json());
    const line = await orderService.saveProduction(id, input, session.sub);
    return ok(line);
  });
}
