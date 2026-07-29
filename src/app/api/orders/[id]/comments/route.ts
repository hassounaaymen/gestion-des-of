import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { handle, ok, requirePermission, requireSession, ApiError } from "@/lib/api";
import { writeAudit, requestMeta } from "@/lib/audit";
import { Role, NotificationType } from "@prisma/client";

const commentSchema = z.object({
  content: z.string().min(1, "Message vide").max(2000),
});

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    await requirePermission("order:read");
    const { id } = await params;
    const comments = await prisma.comment.findMany({
      where: { orderId: id },
      include: { author: { select: { fullName: true, role: true } } },
      orderBy: { createdAt: "asc" },
    });
    return ok(comments);
  });
}

/**
 * Poste un message sur l'OF et prévient l'autre service.
 * C'est le canal de communication Production ↔ Qualité, tracé sur l'ordre.
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const session = await requireSession();
    const { id } = await params;
    const { content } = commentSchema.parse(await req.json());

    const order = await prisma.productionOrder.findUnique({
      where: { id },
      select: { id: true, number: true },
    });
    if (!order) throw new ApiError(404, "OF introuvable");

    const comment = await prisma.comment.create({
      data: { orderId: id, authorId: session.sub, content },
      include: { author: { select: { fullName: true, role: true } } },
    });

    // L'auteur prévient l'autre service + la Direction, jamais lui-même.
    const targets: Role[] = [Role.DIRECTION];
    if (session.role === Role.QUALITY) targets.push(Role.PRODUCTION, Role.PRODUCTION_MANAGER);
    else if (session.role === Role.PRODUCTION) targets.push(Role.QUALITY, Role.PRODUCTION_MANAGER);
    else targets.push(Role.PRODUCTION, Role.QUALITY);

    const recipients = await prisma.user.findMany({
      where: { role: { in: targets }, isActive: true, id: { not: session.sub } },
      select: { id: true },
    });
    if (recipients.length > 0) {
      await prisma.notification.createMany({
        data: recipients.map((u) => ({
          userId: u.id,
          type: NotificationType.VALIDATION_DONE,
          title: `Message sur ${order.number}`,
          message: `${session.fullName} : ${content.slice(0, 120)}`,
          link: `/orders/${id}`,
        })),
      });
    }

    await writeAudit({
      userId: session.sub,
      action: "COMMENT",
      entity: "ProductionOrder",
      entityId: id,
      after: { content },
      ...requestMeta(req),
    });

    return ok(comment, 201);
  });
}
