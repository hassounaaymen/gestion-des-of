import { prisma } from "@/lib/prisma";
import { handle, ok, requirePermission, ApiError } from "@/lib/api";
import { getControlPlanForArticle } from "@/services/quality.service";

/** Renvoie le plan de contrôle applicable à l'OF (tolérances calculées sur les cotes nominales). */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    await requirePermission("quality:read");
    const { id } = await params;
    const order = await prisma.productionOrder.findUnique({
      where: { id },
      include: { article: true },
    });
    if (!order) throw new ApiError(404, "OF introuvable");

    const plan = await getControlPlanForArticle(order.article);
    return ok({
      family: order.article.family,
      designation: order.article.designation,
      points: plan,
    });
  });
}
