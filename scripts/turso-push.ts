/**
 * Applique le schéma Prisma à la base Turso.
 *   npm run db:push:turso
 *
 * `prisma db push` ne convient pas ici : il lit l'URL du bloc `datasource`
 * (un fichier SQLite local) et ignore l'adaptateur libSQL configuré en code.
 * On génère donc le SQL avec `prisma migrate diff`, puis on l'exécute sur
 * Turso via le client libSQL.
 */
import { execFileSync } from "node:child_process";
import { createClient } from "@libsql/client";

const url = process.env.TURSO_DATABASE_URL;
const authToken = process.env.TURSO_AUTH_TOKEN;

if (!url) {
  console.error("❌ TURSO_DATABASE_URL absent. Renseignez-le dans .env");
  process.exit(1);
}

/** Découpe un script SQL en instructions, en respectant les chaînes quotées. */
function splitStatements(sql: string): string[] {
  const out: string[] = [];
  let current = "";
  let inString = false;

  for (let i = 0; i < sql.length; i++) {
    const c = sql[i];
    if (c === "'") {
      // '' à l'intérieur d'une chaîne = apostrophe échappée
      if (inString && sql[i + 1] === "'") {
        current += "''";
        i++;
        continue;
      }
      inString = !inString;
    }
    if (c === ";" && !inString) {
      const stmt = current.trim();
      if (stmt) out.push(stmt);
      current = "";
      continue;
    }
    current += c;
  }
  const last = current.trim();
  if (last) out.push(last);

  return out
    .map((s) =>
      s
        .split("\n")
        .filter((l) => !l.trim().startsWith("--"))
        .join("\n")
        .trim(),
    )
    .filter(Boolean);
}

/** Rend les créations idempotentes pour permettre de rejouer le script. */
function makeIdempotent(stmt: string): string {
  return stmt
    .replace(/^CREATE TABLE (?!IF NOT EXISTS)/i, "CREATE TABLE IF NOT EXISTS ")
    .replace(/^CREATE UNIQUE INDEX (?!IF NOT EXISTS)/i, "CREATE UNIQUE INDEX IF NOT EXISTS ")
    .replace(/^CREATE INDEX (?!IF NOT EXISTS)/i, "CREATE INDEX IF NOT EXISTS ");
}

async function main() {
  console.log(`🎯 Cible : ${url}`);
  console.log("📐 Génération du SQL depuis le schéma Prisma…");

  // `shell: true` est requis sous Windows : depuis Node 20, execFileSync
  // refuse d'exécuter directement les fichiers .cmd (dont npx.cmd).
  const isWindows = process.platform === "win32";
  const sql = execFileSync(
    isWindows ? "npx.cmd" : "npx",
    [
      "prisma",
      "migrate",
      "diff",
      "--from-empty",
      "--to-schema-datamodel",
      "prisma/schema.prisma",
      "--script",
    ],
    { encoding: "utf8", maxBuffer: 20 * 1024 * 1024, shell: isWindows },
  );

  const statements = splitStatements(sql).map(makeIdempotent);
  console.log(`   ${statements.length} instruction(s) à exécuter`);

  const db = createClient({ url: url!, authToken });

  // PRAGMA hors transaction : le batch libSQL est transactionnel
  await db.execute("PRAGMA foreign_keys = OFF");
  await db.batch(statements, "write");
  await db.execute("PRAGMA foreign_keys = ON");

  const tables = await db.execute(
    "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name",
  );
  console.log(`\n✅ Schéma appliqué — ${tables.rows.length} tables :`);
  console.log("   " + tables.rows.map((r) => r.name).join(", "));
}

main().catch((e) => {
  console.error("❌", e instanceof Error ? e.message : e);
  process.exit(1);
});
