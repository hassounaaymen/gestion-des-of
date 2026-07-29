import { NextResponse } from "next/server";
import { getSession, type SessionPayload } from "./session";
import { can, type Permission } from "./rbac";

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

/** Exige une session valide, sinon lève 401. */
export async function requireSession(): Promise<SessionPayload> {
  const session = await getSession();
  if (!session) throw new ApiError(401, "Non authentifié");
  return session;
}

/** Exige une permission précise, sinon lève 403. */
export async function requirePermission(
  permission: Permission,
): Promise<SessionPayload> {
  const session = await requireSession();
  if (!can(session.role, permission)) {
    throw new ApiError(403, "Accès refusé — permission insuffisante");
  }
  return session;
}

/** Enveloppe un handler d'API en normalisant les erreurs. */
export function handle<T>(fn: () => Promise<T>) {
  return fn().catch((err) => {
    if (err instanceof ApiError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    if (err?.name === "ZodError") {
      return NextResponse.json(
        { error: "Validation échouée", details: err.errors },
        { status: 422 },
      );
    }
    console.error("[api] erreur non gérée", err);
    return NextResponse.json(
      { error: "Erreur interne du serveur" },
      { status: 500 },
    );
  });
}

export function ok<T>(data: T, status = 200) {
  return NextResponse.json(data, { status });
}
