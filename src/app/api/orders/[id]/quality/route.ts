import { orderService } from "@/services/order.service";
import { qualitySchema } from "@/lib/validations";
import { handle, ok, requirePermission } from "@/lib/api";

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const session = await requirePermission("quality:write");
    const { id } = await params;
    const input = qualitySchema.parse(await req.json());
    const control = await orderService.saveQuality(id, input, session.sub, session.usine);
    return ok(control);
  });
}
