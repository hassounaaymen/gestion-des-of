import { Role } from "@prisma/client";
import bcrypt from "bcryptjs";
import { DEFAULT_QUALITY_SPECS } from "../src/lib/default-quality-specs";
import { DEFAULT_REJECT_CAUSES } from "../src/lib/default-reject-causes";
import { createPrismaClient, describeTarget } from "../src/lib/db-client";

const prisma = createPrismaClient();

async function main() {
  console.log(`🌱 Seed en cours… → ${describeTarget()}`);

  // ── Utilisateurs (un par rôle) ──────────────────────
  const pwd = await bcrypt.hash("Password123!", 12);

  // Les rôles à portée globale ne sont rattachés à aucune usine (`usine: null`) ;
  // les rôles opérationnels sont cloisonnés sur leur site.
  const users: {
    username: string;
    email: string;
    fullName: string;
    role: Role;
    usine: string | null;
  }[] = [
    { username: "admin", email: "admin@bestbeton.tn", fullName: "Administrateur Système", role: Role.SUPER_ADMIN, usine: null },
    { username: "direction", email: "direction@bestbeton.tn", fullName: "Direction Générale", role: Role.DIRECTION, usine: null },

    // Un directeur par usine
    { username: "dir.quadra", email: "dir.quadra@bestbeton.tn", fullName: "Directeur QUADRA", role: Role.DIRECTEUR_USINE, usine: "QUADRA" },
    { username: "dir.vifesa", email: "dir.vifesa@bestbeton.tn", fullName: "Directeur VIFESA", role: Role.DIRECTEUR_USINE, usine: "VIFESA" },

    // Équipes opérationnelles, rattachées à leur site
    { username: "production", email: "prod@bestbeton.tn", fullName: "Responsable Production QUADRA", role: Role.PRODUCTION, usine: "QUADRA" },
    { username: "qualite", email: "qualite@bestbeton.tn", fullName: "Responsable Qualité QUADRA", role: Role.QUALITY, usine: "QUADRA" },
    { username: "gestion", email: "gestion@bestbeton.tn", fullName: "Gestion Production QUADRA", role: Role.PRODUCTION_MANAGER, usine: "QUADRA" },
    { username: "prod.vifesa", email: "prod.vifesa@bestbeton.tn", fullName: "Responsable Production VIFESA", role: Role.PRODUCTION, usine: "VIFESA" },
    { username: "qual.vifesa", email: "qual.vifesa@bestbeton.tn", fullName: "Responsable Qualité VIFESA", role: Role.QUALITY, usine: "VIFESA" },
    { username: "consultation", email: "viewer@bestbeton.tn", fullName: "Invité Consultation", role: Role.VIEWER, usine: "QUADRA" },
  ];

  for (const u of users) {
    await prisma.user.upsert({
      where: { username: u.username },
      update: { role: u.role, fullName: u.fullName, email: u.email, usine: u.usine },
      create: { ...u, password: pwd },
    });
  }
  console.log(`  ✔ ${users.length} utilisateurs (2 globaux, 2 directeurs d'usine, 6 opérationnels)`);

  // ── Plans de contrôle qualité par famille ───────────
  for (const spec of DEFAULT_QUALITY_SPECS) {
    const { family, parameter, ...rest } = spec;
    await prisma.qualitySpec.upsert({
      where: { family_parameter: { family, parameter } },
      update: rest,
      create: { family, parameter, ...rest },
    });
  }
  console.log(`  ✔ ${DEFAULT_QUALITY_SPECS.length} points de contrôle qualité`);

  // ── Causes de rebut normalisées (5M / Ishikawa) ─────
  for (const c of DEFAULT_REJECT_CAUSES) {
    const { code, ...rest } = c;
    await prisma.rejectCause.upsert({
      where: { code },
      update: rest,
      create: { code, ...rest },
    });
  }
  console.log(`  ✔ ${DEFAULT_REJECT_CAUSES.length} causes de rebut (5M)`);

  const articles = await prisma.article.count();
  const stores = await prisma.store.count();
  console.log(`\n  Référentiel ERP : ${articles} articles, ${stores} magasins`);
  if (articles === 0) {
    console.log("  → Lancez la synchronisation ERP : npm run erp:sync");
  }

  console.log("\n✅ Seed terminé.");
  console.log("   Comptes : admin / production / qualite / gestion / consultation");
  console.log("   Mot de passe : Password123!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
