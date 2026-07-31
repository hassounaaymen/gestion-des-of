import { handle, requirePermission, ApiError } from "@/lib/api";
import {
  buildOrderPdf,
  buildPlanningPdf,
  buildSynthesisPdf,
} from "@/services/export-pdf.service";
import { writeAudit, requestMeta } from "@/lib/audit";
import { scopeUsine } from "@/lib/rbac";

export const maxDuration = 120;

export async function GET(req: Request) {
  return handle(async () => {
    const session = await requirePermission("report:export");
    const sp = new URL(req.url).searchParams;
    const type = sp.get("type") ?? "synthesis";
    const stamp = new Date().toISOString().slice(0, 10);

    let buffer: Buffer;
    let filename: string;

    if (type === "order") {
      const id = sp.get("id");
      if (!id) throw new ApiError(400, "Paramètre `id` requis pour la fiche d'OF");
      buffer = await buildOrderPdf(id, scopeUsine(session));
      filename = `fiche-of-${id.slice(0, 8)}-${stamp}.pdf`;
    } else if (type === "planning") {
      // Mêmes filtres que l'écran : fenêtre de dates (ou périodes) et usine
      const days = Math.min(Math.max(Number(sp.get("days") ?? 14), 7), 28);
      const offset = Number(sp.get("offset") ?? 0) || 0;
      const rawFrom = sp.get("from");
      const rawTo = sp.get("to");
      const usine = scopeUsine(session) ?? sp.get("usine");

      const from = rawFrom ? new Date(`${rawFrom}T00:00:00`) : new Date();
      from.setHours(0, 0, 0, 0);
      if (!rawFrom) from.setDate(from.getDate() + offset * days);

      buffer = await buildPlanningPdf({
        from,
        to: rawTo ? new Date(`${rawTo}T00:00:00`) : undefined,
        days: rawTo ? undefined : days,
        usine,
      });
      const suffix = usine ? `-${usine.replace(/\s+/g, "").toLowerCase()}` : "";
      filename = `planning-production${suffix}-${stamp}.pdf`;
    } else if (type === "synthesis") {
      buffer = await buildSynthesisPdf(scopeUsine(session));
      filename = `rapport-synthese-${stamp}.pdf`;
    } else {
      throw new ApiError(400, `Type d'export inconnu : ${type}`);
    }

    await writeAudit({
      userId: session.sub,
      action: "EXPORT_PDF",
      entity: "Report",
      entityId: type,
      ...requestMeta(req),
    });

    // `inline=1` affiche le document dans le navigateur au lieu de le télécharger
    const inline = sp.get("inline") === "1";

    return new Response(buffer as unknown as ArrayBuffer, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `${inline ? "inline" : "attachment"}; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    });
  });
}
