import { getSession } from "@/lib/session";
import { permissionsFor } from "@/lib/rbac";
import { handle, ok, ApiError } from "@/lib/api";

export async function GET() {
  return handle(async () => {
    const session = await getSession();
    if (!session) throw new ApiError(401, "Non authentifié");
    return ok({
      id: session.sub,
      username: session.username,
      fullName: session.fullName,
      role: session.role,
      permissions: permissionsFor(session.role),
    });
  });
}
