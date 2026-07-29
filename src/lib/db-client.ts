import { PrismaClient } from "@prisma/client";
import { PrismaLibSQL } from "@prisma/adapter-libsql";

/**
 * Fabrique du client Prisma, partagée par l'application et les scripts
 * (seed, synchronisation ERP, migration) pour qu'ils visent tous la même base.
 *
 *  - Sans `TURSO_DATABASE_URL` : fichier SQLite local (développement).
 *  - Avec : Turso via l'adaptateur libSQL — indispensable sur Vercel, dont le
 *    système de fichiers est en lecture seule et éphémère.
 */

export function isTurso() {
  return Boolean(process.env.TURSO_DATABASE_URL);
}

export function createPrismaClient(): PrismaClient {
  const log: ("error" | "warn")[] =
    process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"];

  if (!isTurso()) return new PrismaClient({ log });

  // L'adaptateur reçoit la configuration libSQL et gère lui-même la connexion
  const adapter = new PrismaLibSQL({
    url: process.env.TURSO_DATABASE_URL!,
    authToken: process.env.TURSO_AUTH_TOKEN,
  });
  return new PrismaClient({ adapter, log });
}

/** Cible courante, pour l'affichage dans les scripts. */
export function describeTarget() {
  return isTurso()
    ? `Turso (${process.env.TURSO_DATABASE_URL})`
    : `SQLite local (${process.env.DATABASE_URL ?? "file:./dev.db"})`;
}
