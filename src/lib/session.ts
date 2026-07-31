import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import type { Role } from "@prisma/client";

const COOKIE_NAME = "gof_session";
const secret = new TextEncoder().encode(
  process.env.JWT_SECRET ?? "dev-insecure-secret-change-me",
);
const TIMEOUT_MIN = Number(process.env.SESSION_TIMEOUT_MINUTES ?? 60);

export interface SessionPayload {
  sub: string; // userId
  username: string;
  fullName: string;
  role: Role;
  /** Usine de rattachement ; `null` pour les rôles à portée globale. */
  usine: string | null;
  [key: string]: unknown;
}

export async function createSession(payload: SessionPayload) {
  const token = await new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${TIMEOUT_MIN}m`)
    .sign(secret);

  const store = await cookies();
  store.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: TIMEOUT_MIN * 60,
  });
}

export async function destroySession() {
  const store = await cookies();
  store.delete(COOKIE_NAME);
}

/** Vérifie une chaîne de token (utilisable dans le middleware Edge). */
export async function verifyToken(
  token: string | undefined,
): Promise<SessionPayload | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret);
    return payload as unknown as SessionPayload;
  } catch {
    return null;
  }
}

/** Récupère la session courante côté serveur (Server Components / API). */
export async function getSession(): Promise<SessionPayload | null> {
  const store = await cookies();
  return verifyToken(store.get(COOKIE_NAME)?.value);
}

export const SESSION_COOKIE = COOKIE_NAME;
