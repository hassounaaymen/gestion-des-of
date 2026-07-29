import { prisma } from "@/lib/prisma";
import { handle, ok, requireSession } from "@/lib/api";

/** Notifications de l'utilisateur connecté. */
export async function GET(req: Request) {
  return handle(async () => {
    const session = await requireSession();
    const unreadOnly = new URL(req.url).searchParams.get("unread") === "1";

    const [items, unread] = await Promise.all([
      prisma.notification.findMany({
        where: { userId: session.sub, ...(unreadOnly ? { isRead: false } : {}) },
        orderBy: { createdAt: "desc" },
        take: 30,
      }),
      prisma.notification.count({ where: { userId: session.sub, isRead: false } }),
    ]);

    return ok({ items, unread });
  });
}

/** Marque les notifications comme lues (toutes, ou une seule via `id`). */
export async function PUT(req: Request) {
  return handle(async () => {
    const session = await requireSession();
    const body = await req.json().catch(() => ({}));
    const id = typeof body?.id === "string" ? body.id : undefined;

    await prisma.notification.updateMany({
      where: { userId: session.sub, ...(id ? { id } : {}) },
      data: { isRead: true },
    });
    return ok({ success: true });
  });
}
