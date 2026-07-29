/**
 * Capture les écrans de l'application pour la présentation.
 *   npm run screenshots        (le serveur de développement doit tourner)
 *
 * Réutilise le Chrome ou l'Edge déjà installé — aucun navigateur n'est
 * téléchargé. Les images sont écrites dans `docs/screenshots/`.
 */
import puppeteer from "puppeteer-core";
import { existsSync, mkdirSync } from "node:fs";
import { prisma } from "../src/lib/prisma";

const BASE = process.env.APP_URL ?? "http://localhost:3100";
const OUT = "docs/screenshots";

const CANDIDATES = [
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
];

interface Shot {
  name: string;
  /** Chemin fixe, ou fonction résolue au lancement (ex. choisir le bon OF) */
  path: string | (() => Promise<string>);
  user: string;
  wait?: number;
  /** Fait défiler jusqu'au texte indiqué avant de capturer */
  scrollTo?: string;
}

/** Un OF représentatif : production saisie, quantités renseignées. */
async function orderWithProduction(): Promise<string> {
  const o = await prisma.productionOrder.findFirst({
    where: { productionLines: { some: { qteProduite: { gt: 0 } } } },
    orderBy: { date: "desc" },
    select: { id: true },
  });
  if (!o) throw new Error("Aucun OF avec production saisie");
  return `/orders/${o.id}`;
}

/** Un OF contrôlé par la Qualité : le panneau de validation est visible. */
async function orderWithQuality(): Promise<string> {
  const o = await prisma.productionOrder.findFirst({
    where: { qualityControls: { some: { qteControlee: { gt: 0 } } } },
    orderBy: { date: "desc" },
    select: { id: true },
  });
  if (!o) throw new Error("Aucun OF avec contrôle qualité");
  return `/orders/${o.id}`;
}

/** Écrans à capturer, dans l'ordre de la présentation. */
const SHOTS: Shot[] = [
  { name: "01-connexion", path: "/login", user: "" },
  { name: "02-tableau-de-bord", path: "/dashboard", user: "direction", wait: 2200 },
  { name: "03-planning", path: "/planning", user: "production", wait: 1400 },
  { name: "04-ordres", path: "/orders", user: "production", wait: 1000 },
  { name: "05-ordre-detail", path: orderWithProduction, user: "production", wait: 1400 },
  {
    name: "06-controle-qualite",
    path: orderWithQuality,
    user: "qualite",
    scrollTo: "Validation quantitative",
    wait: 1800,
  },
  { name: "07-ecarts", path: "/ecarts", user: "direction", wait: 1000 },
  { name: "08-articles", path: "/articles", user: "production", wait: 1600 },
  { name: "09-rapports", path: "/reports", user: "direction", wait: 900 },
];

async function main() {
  const executablePath = CANDIDATES.find((p) => existsSync(p));
  if (!executablePath) {
    console.error("❌ Aucun navigateur trouvé (Chrome ou Edge attendu).");
    process.exit(1);
  }
  mkdirSync(OUT, { recursive: true });
  console.log(`🌐 Navigateur : ${executablePath.split("\\").pop()}`);
  console.log(`🎯 Cible      : ${BASE}\n`);

  const browser = await puppeteer.launch({
    executablePath,
    headless: true,
    args: ["--no-sandbox", "--disable-dev-shm-usage"],
  });

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1560, height: 950, deviceScaleFactor: 2 });

    let currentUser: string | null = null;

    for (const shot of SHOTS) {
      // Bascule de compte uniquement lorsque nécessaire
      if (shot.user && shot.user !== currentUser) {
        await page.goto(`${BASE}/login`, { waitUntil: "networkidle2" });
        await page.evaluate(async (u) => {
          await fetch("/api/auth/logout", { method: "POST" });
          await fetch("/api/auth/login", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ identifier: u, password: "Password123!" }),
          });
        }, shot.user);
        currentUser = shot.user;
      } else if (!shot.user && currentUser) {
        await page.evaluate(() => fetch("/api/auth/logout", { method: "POST" }));
        currentUser = null;
      }

      const path = typeof shot.path === "string" ? shot.path : await shot.path();
      await page.goto(`${BASE}${path}`, { waitUntil: "networkidle2" });

      // Laisse le temps aux animations et aux graphiques de se stabiliser
      await new Promise((r) => setTimeout(r, shot.wait ?? 800));

      if (shot.scrollTo) {
        await page.evaluate((label) => {
          const el = [...document.querySelectorAll("*")].find(
            (x) => x.textContent?.trim() === label,
          );
          el?.scrollIntoView({ block: "start" });
          window.scrollBy(0, -90);
        }, shot.scrollTo);
        await new Promise((r) => setTimeout(r, 500));
      }

      const file = `${OUT}/${shot.name}.png`;
      await page.screenshot({ path: file as `${string}.png` });
      console.log(`  ✔ ${shot.name.padEnd(22)} ${path}`);
    }
  } finally {
    await browser.close();
  }

  console.log(`\n✅ Captures enregistrées dans ${OUT}/`);
}

main()
  .catch((e) => {
    console.error("❌", e instanceof Error ? e.message : e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
