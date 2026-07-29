/**
 * Synchronisation ERP en ligne de commande.
 *   npm run erp:sync
 */
import { erpService, isErpConfigured } from "../src/services/erp.service";
import { prisma } from "../src/lib/prisma";
import { describeTarget } from "../src/lib/db-client";

async function main() {
  if (!isErpConfigured()) {
    console.error("❌ ERP non configuré (ERP_BASE_URL / ERP_COMPANY / ERP_USER / ERP_PASSWORD)");
    process.exit(1);
  }

  console.log(`🎯 Base cible : ${describeTarget()}`);
  console.log("🔌 Connexion à Business Central…");
  const ping = await erpService.ping();
  if (!ping.ok) {
    console.error(`❌ Connexion impossible : ${ping.error}`);
    process.exit(1);
  }
  console.log("   ✔ Connexion établie");

  console.log("📦 Synchronisation des articles…");
  const report = await erpService.syncAll();

  console.log(
    `   ✔ Articles : ${report.articles.fetched} reçus — ${report.articles.created} créés, ${report.articles.updated} mis à jour`,
  );
  console.log(
    `   ✔ Magasins : ${report.stores.fetched} reçus — ${report.stores.created} créés, ${report.stores.updated} mis à jour`,
  );

  const manufactured = await prisma.article.count({ where: { isManufactured: true } });
  const byLine = await prisma.article.groupBy({
    by: ["productionLine"],
    where: { isManufactured: true },
    _count: true,
  });

  console.log(`\n   Articles fabricables : ${manufactured}`);
  for (const l of byLine.sort((a, b) => b._count - a._count)) {
    console.log(`     • ${l.productionLine ?? "(sans ligne)"} : ${l._count}`);
  }
  console.log(`\n✅ Terminé en ${(report.durationMs / 1000).toFixed(1)}s`);
}

main()
  .catch((e) => {
    console.error("❌", e instanceof Error ? e.message : e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
