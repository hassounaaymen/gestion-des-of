import { erpService, ErpNotConfiguredError } from "@/services/erp.service";
import { handle, ok, requirePermission, ApiError } from "@/lib/api";
import { writeAudit, requestMeta } from "@/lib/audit";

export const maxDuration = 300;

export async function POST(req: Request) {
  return handle(async () => {
    const session = await requirePermission("erp:sync");
    try {
      const report = await erpService.syncAll();
      await writeAudit({
        userId: session.sub,
        action: "ERP_SYNC",
        entity: "ERP",
        after: report,
        ...requestMeta(req),
      });
      return ok(report);
    } catch (e) {
      if (e instanceof ErpNotConfiguredError) throw new ApiError(503, e.message);
      throw new ApiError(
        502,
        `Synchronisation ERP impossible : ${e instanceof Error ? e.message : "erreur inconnue"}`,
      );
    }
  });
}

/** Diagnostic de connexion à l'ERP. */
export async function GET() {
  return handle(async () => {
    await requirePermission("erp:read");
    const status = await erpService.ping();
    return ok({ configured: erpService.isConfigured(), ...status });
  });
}
