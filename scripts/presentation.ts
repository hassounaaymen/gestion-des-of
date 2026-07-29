/**
 * Génère la présentation PDF de l'application, écran par écran.
 *   npm run screenshots && npm run presentation
 *
 * Les captures viennent de `docs/screenshots/` et les chiffres de la base :
 * le document reflète l'état réel de l'application, pas des valeurs figées.
 */
import PDFDocument from "pdfkit";
import { createWriteStream, existsSync } from "node:fs";
import { prisma } from "../src/lib/prisma";

type Doc = PDFKit.PDFDocument;

// ── Charte ───────────────────────────────────────────────────
const BLUE = "#1e4e8c";
const BLUE_LIGHT = "#e8eef7";
const GREY = "#6b7280";
const DARK = "#111827";
const GREEN = "#16a34a";
const ORANGE = "#e08e0b";
const RED = "#c0392b";
const LINE = "#d8dee7";

const W = 841.89; // A4 paysage
const H = 595.28;
const M = 46;
const SHOTS = "docs/screenshots";

let page = 0;

function slide(doc: Doc, title: string, subtitle?: string) {
  if (page > 0) doc.addPage();
  page++;

  doc.rect(0, 0, W, 4).fill(BLUE);
  doc.fillColor(BLUE).fontSize(21).font("Helvetica-Bold")
    .text(title, M, 40, { width: W - 2 * M, lineBreak: false });
  if (subtitle) {
    doc.fillColor(GREY).fontSize(10.5).font("Helvetica")
      .text(subtitle, M, 68, { width: W - 2 * M, lineBreak: false });
  }

  const b = doc.page.margins.bottom;
  doc.page.margins.bottom = 0;
  doc.fillColor(LINE).fontSize(8).font("Helvetica")
    .text("Gestion des Ordres de Fabrication — Best Béton", M, H - 28, { width: 380, lineBreak: false })
    .text(String(page), W - M - 40, H - 28, { width: 40, align: "right", lineBreak: false });
  doc.page.margins.bottom = b;

  doc.fillColor(DARK);
  doc.x = M;
  doc.y = subtitle ? 96 : 82;
}

/**
 * Diapositive d'écran : la capture à gauche, le commentaire à droite.
 * `points` est une liste [titre, explication].
 */
function screenSlide(
  doc: Doc,
  title: string,
  subtitle: string,
  image: string,
  who: string,
  points: [string, string][],
) {
  slide(doc, title, subtitle);

  const imgW = 498;
  const imgX = M;
  const imgY = 104;
  const file = `${SHOTS}/${image}`;

  if (existsSync(file)) {
    // Cadre léger pour détacher la capture du fond
    doc.roundedRect(imgX - 3, imgY - 3, imgW + 6, imgW / 1.642 + 6, 5)
      .lineWidth(1).strokeColor(LINE).stroke();
    doc.image(file, imgX, imgY, { width: imgW });
  } else {
    doc.roundedRect(imgX, imgY, imgW, imgW / 1.642, 5).fill("#f3f4f6");
    doc.fillColor(GREY).fontSize(10).font("Helvetica")
      .text(`Capture manquante : ${image}`, imgX, imgY + 140, { width: imgW, align: "center" });
  }

  // Colonne de commentaire
  const tx = imgX + imgW + 20;
  const tw = W - M - tx;

  doc.roundedRect(tx, imgY, tw, 22, 4).fill(BLUE_LIGHT);
  doc.fillColor(BLUE).fontSize(8.5).font("Helvetica-Bold")
    .text(who.toUpperCase(), tx + 8, imgY + 7, { width: tw - 16, lineBreak: false });

  let y = imgY + 36;
  for (const [t, d] of points) {
    doc.fillColor(BLUE).fontSize(10).font("Helvetica-Bold")
      .text(t, tx, y, { width: tw });
    y = doc.y + 2;
    doc.fillColor(DARK).fontSize(9).font("Helvetica")
      .text(d, tx, y, { width: tw });
    y = doc.y + 11;
  }
}

function bullet(doc: Doc, text: string, x: number, y: number, width: number) {
  doc.circle(x + 3, y + 5, 2.5).fill(BLUE);
  doc.fillColor(DARK).fontSize(10.5).font("Helvetica").text(text, x + 14, y, { width: width - 14 });
  return doc.y + 6;
}

function kpi(doc: Doc, x: number, y: number, w: number, value: string, label: string, hint?: string) {
  doc.roundedRect(x, y, w, 88, 6).fill(BLUE_LIGHT);
  doc.fillColor(BLUE).fontSize(27).font("Helvetica-Bold")
    .text(value, x, y + 16, { width: w, align: "center", lineBreak: false });
  doc.fillColor(DARK).fontSize(10).font("Helvetica-Bold")
    .text(label, x, y + 50, { width: w, align: "center", lineBreak: false });
  if (hint) {
    doc.fillColor(GREY).fontSize(8).font("Helvetica")
      .text(hint, x, y + 65, { width: w, align: "center", lineBreak: false });
  }
}

function box(doc: Doc, x: number, y: number, w: number, h: number, title: string, color = BLUE) {
  doc.roundedRect(x, y, w, h, 6).lineWidth(1.2).strokeColor(color).stroke();
  doc.roundedRect(x, y, w, 26, 6).fill(color);
  doc.rect(x, y + 18, w, 8).fill(color);
  doc.fillColor("#ffffff").fontSize(10).font("Helvetica-Bold")
    .text(title, x + 10, y + 8, { width: w - 20, lineBreak: false });
  doc.fillColor(DARK);
}

function arrow(doc: Doc, x1: number, y: number, x2: number, color = BLUE) {
  doc.moveTo(x1, y).lineTo(x2 - 6, y).lineWidth(1.5).strokeColor(color).stroke();
  doc.moveTo(x2, y).lineTo(x2 - 8, y - 4).lineTo(x2 - 8, y + 4).fill(color);
}

function step(doc: Doc, x: number, y: number, w: number, n: string, label: string, who: string, color: string) {
  doc.roundedRect(x, y, w, 72, 6).fill(color);
  doc.fillColor("#ffffff").fontSize(9).font("Helvetica-Bold")
    .text(n, x, y + 10, { width: w, align: "center", lineBreak: false });
  doc.fontSize(11).font("Helvetica-Bold").text(label, x + 6, y + 26, { width: w - 12, align: "center" });
  doc.fontSize(8).font("Helvetica").text(who, x + 6, y + 54, { width: w - 12, align: "center", lineBreak: false });
  doc.fillColor(DARK);
}

async function main() {
  const [articles, fabricables, magasins, specs, causes, lignes] = await Promise.all([
    prisma.article.count(),
    prisma.article.count({ where: { isManufactured: true } }),
    prisma.store.count(),
    prisma.qualitySpec.count(),
    prisma.rejectCause.count(),
    prisma.article.groupBy({
      by: ["productionLine"],
      where: { isManufactured: true, productionLine: { not: null } },
      _count: true,
    }),
  ]);
  const usines = lignes.sort((a, b) => b._count - a._count).map((l) => `${l.productionLine} (${l._count})`);

  const doc = new PDFDocument({ size: [W, H], margin: M, bufferPages: true });
  const out = createWriteStream("presentation-gestion-of.pdf");
  doc.pipe(out);

  // ── 1. Couverture ──────────────────────────────────
  page++;
  doc.rect(0, 0, W, H).fill(BLUE);
  doc.fillColor("#ffffff").fontSize(13).font("Helvetica").text("BEST BÉTON", M, 150, { lineBreak: false });
  doc.fontSize(40).font("Helvetica-Bold")
    .text("Gestion des Ordres", M, 180, { lineBreak: false })
    .text("de Fabrication", M, 226, { lineBreak: false });
  doc.rect(M, 288, 90, 3).fill("#ffffff");
  doc.fontSize(14).font("Helvetica")
    .text("Piloter la production et la qualité du béton préfabriqué", M, 310, { width: 620, lineBreak: false });
  doc.fontSize(10).fillColor("#b9c9e0")
    .text(`Intégré à Microsoft Dynamics NAV 2018  ·  ${new Date().toLocaleDateString("fr-FR")}`,
      M, 340, { width: 620, lineBreak: false });

  // ── 2. Le constat ──────────────────────────────────
  slide(doc, "Le constat", "Pourquoi une application dédiée");
  let y = 118;
  const colW = (W - 2 * M - 30) / 2;

  box(doc, M, y, colW, 196, "Aujourd'hui");
  let by = y + 42;
  by = bullet(doc, "Le suivi de production vit dans des fichiers Excel dispersés.", M + 12, by, colW - 24);
  by = bullet(doc, "Production et Qualité travaillent chacune de leur côté.", M + 12, by, colW - 24);
  by = bullet(doc, "Le module Production de NAV est trop complexe pour l'atelier.", M + 12, by, colW - 24);
  bullet(doc, "La Direction n'a pas de vue consolidée en temps réel.", M + 12, by, colW - 24);

  box(doc, M + colW + 30, y, colW, 196, "Ce que nous visons", GREEN);
  by = y + 42;
  const x2 = M + colW + 42;
  by = bullet(doc, "Des écrans simples, pensés pour chaque métier.", x2, by, colW - 24);
  by = bullet(doc, "Production et Qualité qui se parlent sur l'ordre.", x2, by, colW - 24);
  by = bullet(doc, "Une traçabilité complète et infalsifiable.", x2, by, colW - 24);
  bullet(doc, "La Direction qui voit tout, à tout moment.", x2, by, colW - 24);

  doc.roundedRect(M, 344, W - 2 * M, 52, 6).fill(BLUE_LIGHT);
  doc.fillColor(BLUE).fontSize(13).font("Helvetica-Bold")
    .text("L'application ne remplace pas NAV : elle en devient la couche opérationnelle simple.",
      M, 363, { width: W - 2 * M, align: "center", lineBreak: false });

  // ── 3. Chiffres clés ───────────────────────────────
  slide(doc, "Le référentiel, en chiffres", "Données réelles importées de Business Central");
  const kw = (W - 2 * M - 4 * 18) / 5;
  kpi(doc, M, 130, kw, String(articles), "articles", "référentiel ERP");
  kpi(doc, M + (kw + 18), 130, kw, String(fabricables), "fabricables", "produits finis et semi-finis");
  kpi(doc, M + 2 * (kw + 18), 130, kw, String(magasins), "magasins", "dont 6 usines");
  kpi(doc, M + 3 * (kw + 18), 130, kw, String(specs), "points de contrôle", "plans qualité par famille");
  kpi(doc, M + 4 * (kw + 18), 130, kw, String(causes), "causes de rebut", "classées 5M");

  doc.fillColor(DARK).fontSize(12).font("Helvetica-Bold").text("Six usines, six presses", M, 258, { lineBreak: false });
  doc.fillColor(GREY).fontSize(10).font("Helvetica")
    .text("Chaque unité de production est bâtie autour d'une machine. L'application reprend ce découpage :",
      M, 278, { width: W - 2 * M });
  let ux = M;
  for (const u of usines) {
    const w = doc.widthOfString(u) + 26;
    doc.roundedRect(ux, 302, w, 26, 13).fill(BLUE_LIGHT);
    doc.fillColor(BLUE).fontSize(10).font("Helvetica-Bold")
      .text(u, ux, 310, { width: w, align: "center", lineBreak: false });
    ux += w + 10;
  }
  doc.fillColor(GREY).fontSize(9).font("Helvetica")
    .text("Entre parenthèses : le nombre d'articles fabricables affectés à la ligne.", M, 342, { width: W - 2 * M });

  // ── 4 à 12 : les écrans ────────────────────────────
  screenSlide(doc, "L'entrée dans l'application", "Un accès nominatif, une session limitée dans le temps",
    "01-connexion.png", "Tous les utilisateurs", [
      ["Identification personnelle", "Chaque action sera rattachée à son auteur : aucune saisie anonyme."],
      ["Connexion par identifiant ou e-mail", "Le mot de passe n'est jamais stocké en clair."],
      ["Session expirante", "La session se ferme automatiquement après une période d'inactivité."],
    ]);

  screenSlide(doc, "Le tableau de bord", "L'état de la production en un coup d'œil",
    "02-tableau-de-bord.png", "Direction Générale", [
      ["Les indicateurs qui comptent", "Ordres en cours, quantités bonnes et rebutées, taux de rebut, rendement."],
      ["L'écart Production / Qualité", "Un indicateur dédié signale les ordres où les deux services divergent."],
      ["Analyse visuelle", "Production journalière, top articles, Pareto des défauts et axes 5M."],
      ["Référentiel visible", "Le bandeau rappelle le volume importé de l'ERP et la date de mise à jour."],
    ]);

  screenSlide(doc, "Le planning de production", "La charge de chaque atelier sur un horizon glissant",
    "03-planning.png", "Production · Gestion de Production", [
      ["Une ligne par atelier", "Chaque ordre est une barre positionnée sur ses dates, colorée selon son étape."],
      ["Les retards sautent aux yeux", "Un ordre dont la date de fin est dépassée passe en rouge."],
      ["Créer sans quitter le planning", "Un clic sur un créneau ouvre la création d'ordre, atelier et date déjà remplis."],
      ["Filtres", "Par période et par usine ; la fiche PDF reprend exactement le même filtrage."],
    ]);

  screenSlide(doc, "Les ordres de fabrication", "Le registre complet, filtrable et traçable",
    "04-ordres.png", "Production", [
      ["Vue d'ensemble", "Numéro, article, magasin, atelier, équipe, quantités et statut."],
      ["Statut lisible", "Chaque ordre affiche son étape dans le cycle de validation."],
      ["Numérotation automatique", "Les ordres sont numérotés par l'application, sans risque de doublon."],
    ]);

  screenSlide(doc, "La saisie de production", "Ce que le chef d'atelier renseigne",
    "05-ordre-detail.png", "Responsable Production", [
      ["Le fil du cycle", "La frise rappelle l'étape atteinte et ce qu'il reste à faire."],
      ["Cohérence contrôlée", "Quantité bonne + rebut doit égaler la quantité produite ; l'écran le vérifie en direct."],
      ["Cause de rebut obligatoire", "Choisie dans une liste fermée classée selon les 5M, jamais en texte libre."],
      ["Indicateurs immédiats", "Rendement, taux de rebut, avancement et cadence se calculent pendant la saisie."],
    ]);

  screenSlide(doc, "Le contrôle qualité", "Le cœur du dispositif : un contrôle guidé et confronté",
    "06-controle-qualite.png", "Responsable Qualité", [
      ["Validation en quantités", "La Qualité déclare ce qu'elle accepte et ce qu'elle refuse, indépendamment."],
      ["Confrontation automatique", "Le tableau compare les deux déclarations et affiche l'écart, ici −13 sur le conforme."],
      ["Tolérances calculées", "Les cotes attendues sont déduites de la désignation ERP ; le verdict s'affiche en direct."],
      ["Décision assistée", "L'application propose une décision ; le contrôleur reste souverain."],
    ]);

  screenSlide(doc, "Les écarts Production / Qualité", "Ce que l'Excel ne permettait pas de voir",
    "07-ecarts.png", "Direction Générale", [
      ["La liste des divergences", "Tous les ordres où la validation Qualité s'écarte de la déclaration Production."],
      ["Un écart qualifié", "Au-delà de 5 % de la quantité produite, l'écart est classé majeur et surligné."],
      ["Taux de concordance", "Un indicateur global mesure l'alignement entre les deux services."],
      ["Traçable", "Chaque ligne renvoie à l'ordre concerné et à son historique complet."],
    ]);

  screenSlide(doc, "Le référentiel articles", "Importé de l'ERP, jamais modifié ici",
    "08-articles.png", "Tous les utilisateurs", [
      ["Lecture seule assumée", "Les articles viennent de Business Central et y restent maîtres."],
      ["Recherche et filtres", "Par code, désignation, famille, ligne de production ou nature."],
      ["Nature déduite", "L'application distingue produits finis, semi-finis, matières et consommables."],
      ["Seuls les fabricables", "Un ordre ne peut porter que sur un article réellement fabriqué."],
    ]);

  screenSlide(doc, "Les rapports", "Des documents prêts à diffuser",
    "09-rapports.png", "Direction · Production · Qualité", [
      ["Fiche planning", "Le Gantt en PDF paysage, à afficher en atelier, avec cartouche de visas."],
      ["Fiche d'ordre", "Production, qualité, écarts, non-conformités et échanges, sur un seul document."],
      ["Rapport de synthèse", "Indicateurs, performance par atelier et par équipe, Pareto et écarts."],
      ["Registres Excel", "Ordres, écarts et non-conformités, filtrables, totalisés et exploitables."],
    ]);

  // ── 13. Le workflow ────────────────────────────────
  slide(doc, "Le cycle de vie d'un ordre", "Chaque étape est verrouillée, horodatée et signée");
  const sw = (W - 2 * M - 4 * 22) / 5;
  const sy = 160;
  step(doc, M, sy, sw, "1", "Production", "Responsable Production", BLUE);
  arrow(doc, M + sw + 4, sy + 36, M + sw + 18);
  step(doc, M + sw + 22, sy, sw, "2", "Validation\nProduction", "Responsable Production", "#3b6fb5");
  arrow(doc, M + 2 * (sw + 22) - 14, sy + 36, M + 2 * (sw + 22) - 4);
  step(doc, M + 2 * (sw + 22), sy, sw, "3", "Contrôle\nQualité", "Responsable Qualité", ORANGE);
  arrow(doc, M + 3 * (sw + 22) - 14, sy + 36, M + 3 * (sw + 22) - 4);
  step(doc, M + 3 * (sw + 22), sy, sw, "4", "Validation\nQualité", "Responsable Qualité", GREEN);
  arrow(doc, M + 4 * (sw + 22) - 14, sy + 36, M + 4 * (sw + 22) - 4);
  step(doc, M + 4 * (sw + 22), sy, sw, "5", "Clôture", "Gestion Production", "#4b5563");

  y = 274;
  doc.roundedRect(M, y, W - 2 * M, 88, 6).fill("#fff7ed");
  doc.fillColor(RED).fontSize(12).font("Helvetica-Bold")
    .text("La règle qui change tout", M + 16, y + 14, { lineBreak: false });
  doc.fillColor(DARK).fontSize(10.5).font("Helvetica")
    .text("Une fois la production validée, ses données sont verrouillées définitivement. " +
      "La Qualité ne peut jamais les modifier : elle saisit son propre constat, en parallèle. " +
      "C'est cette indépendance qui rend l'écart entre les deux services mesurable — et donc exploitable.",
      M + 16, y + 36, { width: W - 2 * M - 32 });

  // ── 14. Rôles ──────────────────────────────────────
  slide(doc, "Chacun son périmètre", "Six rôles, des permissions fines, aucune zone grise");
  y = 118;
  const roles: [string, string, string][] = [
    ["Direction Générale", "Voit tout, pilote et exporte. Ne saisit jamais à la place des équipes.", "#7c3aed"],
    ["Responsable Production", "Crée et planifie les ordres, saisit la production, la valide.", BLUE],
    ["Responsable Qualité", "Contrôle et valide la qualité. Ne peut pas modifier la production.", GREEN],
    ["Gestion Production", "Planifie et clôture les ordres après validation qualité.", ORANGE],
    ["Consultation", "Lecture seule.", GREY],
    ["Administrateur", "Comptes, référentiels et synchronisation ERP.", "#4b5563"],
  ];
  const rw = (W - 2 * M - 24) / 3;
  roles.forEach(([r, d, c], i) => {
    const x = M + (i % 3) * (rw + 12);
    const ry = y + Math.floor(i / 3) * 100;
    doc.roundedRect(x, ry, rw, 86, 6).fill("#f9fafb");
    doc.rect(x, ry, 4, 86).fill(c);
    doc.fillColor(c).fontSize(12).font("Helvetica-Bold").text(r, x + 16, ry + 14, { width: rw - 28, lineBreak: false });
    doc.fillColor(DARK).fontSize(10).font("Helvetica").text(d, x + 16, ry + 36, { width: rw - 28 });
  });
  doc.fillColor(GREY).fontSize(10).font("Helvetica")
    .text("Toute action est journalisée : qui, quand, valeur avant et après, adresse IP, navigateur. Les journaux ne peuvent pas être supprimés.",
      M, y + 212, { width: W - 2 * M });

  // ── 15. Suite ──────────────────────────────────────
  slide(doc, "La suite", "Ce qui est prêt et ce qui vient");
  y = 118;
  const half = (W - 2 * M - 30) / 2;

  box(doc, M, y, half, 232, "Opérationnel aujourd'hui", GREEN);
  by = y + 42;
  for (const t of [
    "Référentiel ERP synchronisé, en lecture seule",
    "Cycle complet de l'ordre, verrouillé et signé",
    "Contrôle qualité guidé par plans de contrôle",
    "Écarts Production / Qualité et non-conformités",
    "Analyse des causes selon les 5M",
    "Planning et création d'ordres depuis le planning",
    "Rapports PDF et registres Excel",
  ]) by = bullet(doc, t, M + 12, by, half - 24);

  box(doc, M + half + 30, y, half, 232, "Prochaines étapes", ORANGE);
  by = y + 42;
  const x3 = M + half + 42;
  for (const t of [
    "Traitement des non-conformités : action corrective, responsable, clôture",
    "Édition des plans de contrôle par le Responsable Qualité",
    "Gestion des comptes utilisateurs",
    "Recherche globale",
    "Remontée des ordres vers NAV, si les services web Production y sont publiés",
  ]) by = bullet(doc, t, x3, by, half - 24);

  // ── 16. Clôture ────────────────────────────────────
  page++;
  doc.addPage();
  doc.rect(0, 0, W, H).fill(BLUE);
  doc.fillColor("#ffffff").fontSize(30).font("Helvetica-Bold")
    .text("Une production tracée,", M, 210, { lineBreak: false })
    .text("une qualité mesurée,", M, 250, { lineBreak: false })
    .text("une direction informée.", M, 290, { lineBreak: false });
  doc.rect(M, 348, 90, 3).fill("#ffffff");
  doc.fillColor("#b9c9e0").fontSize(12).font("Helvetica")
    .text("Gestion des Ordres de Fabrication — Best Béton", M, 372, { lineBreak: false });

  doc.end();
  await new Promise<void>((resolve) => out.on("finish", () => resolve()));
  console.log(`✅ presentation-gestion-of.pdf — ${page} diapositives`);
}

main()
  .catch((e) => {
    console.error("❌", e instanceof Error ? e.message : e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
