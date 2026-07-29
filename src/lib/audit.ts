import { prisma } from "./prisma";

interface AuditInput {
  userId?: string | null;
  action: string;
  entity: string;
  entityId?: string | null;
  before?: unknown;
  after?: unknown;
  ipAddress?: string | null;
  userAgent?: string | null;
}

/** Écrit une entrée d'historique immuable. Best-effort: n'interrompt jamais le flux métier. */
export async function writeAudit(input: AuditInput): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        userId: input.userId ?? null,
        action: input.action,
        entity: input.entity,
        entityId: input.entityId ?? null,
        before: input.before ? JSON.stringify(input.before) : null,
        after: input.after ? JSON.stringify(input.after) : null,
        ipAddress: input.ipAddress ?? null,
        userAgent: input.userAgent ?? null,
      },
    });
  } catch (err) {
    console.error("[audit] échec écriture log", err);
  }
}

/** Extrait IP + User-Agent d'une requête entrante. */
export function requestMeta(req: Request) {
  const h = req.headers;
  const ip =
    h.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    h.get("x-real-ip") ??
    null;
  return { ipAddress: ip, userAgent: h.get("user-agent") };
}
