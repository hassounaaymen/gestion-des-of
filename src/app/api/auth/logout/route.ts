import { destroySession, getSession } from "@/lib/session";
import { handle, ok } from "@/lib/api";
import { writeAudit, requestMeta } from "@/lib/audit";

export async function POST(req: Request) {
  return handle(async () => {
    const session = await getSession();
    if (session) {
      await writeAudit({
        userId: session.sub,
        action: "LOGOUT",
        entity: "User",
        entityId: session.sub,
        ...requestMeta(req),
      });
    }
    await destroySession();
    return ok({ success: true });
  });
}
