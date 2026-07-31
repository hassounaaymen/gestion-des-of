import { userService } from "@/services/user.service";
import { userUpdateSchema } from "@/lib/validations";
import { handle, ok, requirePermission } from "@/lib/api";

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const session = await requirePermission("user:manage");
    const { id } = await params;
    const input = userUpdateSchema.parse(await req.json());
    const user = await userService.update(session, id, input);
    return ok(user);
  });
}
