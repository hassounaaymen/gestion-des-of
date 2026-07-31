import { handle, requirePermission, ApiError } from "@/lib/api";
import {
  buildOrdersWorkbook,
  buildEcartsWorkbook,
  buildNcWorkbook,
} from "@/services/export-excel.service";
import { writeAudit, requestMeta } from "@/lib/audit";
import { scopeUsine } from "@/lib/rbac";

export const maxDuration = 120;

const BUILDERS = {
  orders: { build: buildOrdersWorkbook, file: "ordres-de-fabrication" },
  ecarts: { build: buildEcartsWorkbook, file: "ecarts-production-qualite" },
  nc: { build: buildNcWorkbook, file: "non-conformites" },
} as const;

export async function GET(req: Request) {
  return handle(async () => {
    const session = await requirePermission("report:export");
    const type = new URL(req.url).searchParams.get("type") ?? "orders";

    const builder = BUILDERS[type as keyof typeof BUILDERS];
    if (!builder) throw new ApiError(400, `Type d'export inconnu : ${type}`);

    const buffer = await builder.build(scopeUsine(session));
    const stamp = new Date().toISOString().slice(0, 10);

    await writeAudit({
      userId: session.sub,
      action: "EXPORT_EXCEL",
      entity: "Report",
      entityId: type,
      ...requestMeta(req),
    });

    return new Response(buffer as ArrayBuffer, {
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${builder.file}-${stamp}.xlsx"`,
        "Cache-Control": "no-store",
      },
    });
  });
}
