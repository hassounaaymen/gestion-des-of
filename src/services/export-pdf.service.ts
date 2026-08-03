import PDFDocument from "pdfkit";
import { prisma } from "@/lib/prisma";
import { getEcarts } from "./ecarts.service";
import { getDashboardData } from "./dashboard.service";
import { getPlanning } from "./planning.service";
import { ORDER_STATUS, QUALITY_DECISION } from "@/lib/status";
import { reconcile } from "@/lib/reconciliation";
import { formatDate, formatDateTime, formatNumber } from "@/lib/utils";

/**
 * Génération des PDF (impression professionnelle).
 * pdfkit écrit en flux : on agrège en Buffer pour la réponse HTTP.
 */

const BLUE = "#1e4e8c";
const GREY = "#666666";
const LIGHT = "#f2f5f9";
const RED = "#c00000";

type Doc = PDFKit.PDFDocument;

interface RenderOptions {
  landscape?: boolean;
  margin?: number;
}

function render(build: (doc: Doc) => void, opts?: RenderOptions): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: "A4",
      layout: opts?.landscape ? "landscape" : "portrait",
      margin: opts?.margin ?? 40,
      bufferPages: true,
    });
    const chunks: Buffer[] = [];
    doc.on("data", (c: Buffer) => chunks.push(c));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
    try {
      build(doc);
      addFooters(doc);
      doc.end();
    } catch (e) {
      reject(e);
    }
  });
}

function header(doc: Doc, title: string, subtitle?: string) {
  const m = doc.page.margins.left;
  doc.rect(0, 0, doc.page.width, 70).fill(BLUE);
  doc.fillColor("#ffffff").fontSize(16).font("Helvetica-Bold")
    .text("BEST BÉTON", m, 20);
  doc.fontSize(9).font("Helvetica")
    .text("Gestion des Ordres de Fabrication", m, 40);
  doc.fontSize(13).font("Helvetica-Bold")
    .text(title, m, 20, { align: "right", width: doc.page.width - 2 * m });
  if (subtitle) {
    doc.fontSize(8).font("Helvetica")
      .text(subtitle, m, 42, { align: "right", width: doc.page.width - 2 * m });
  }
  doc.fillColor("#000000");
  doc.x = m;
  doc.y = 90;
}

function addFooters(doc: Doc) {
  const range = doc.bufferedPageRange();
  const stamp = new Date().toLocaleString("fr-FR");
  for (let i = range.start; i < range.start + range.count; i++) {
    doc.switchToPage(i);
    const m = doc.page.margins.left;
    const y = doc.page.height - 26;

    // Le pied de page s'écrit sous la marge basse. Tant que celle-ci est
    // active, pdfkit estime qu'il n'y a plus de place et bascule le texte sur
    // une page supplémentaire — qui reçoit à son tour un pied de page.
    // On neutralise donc la marge le temps de l'écriture.
    const bottom = doc.page.margins.bottom;
    doc.page.margins.bottom = 0;

    doc.fontSize(7).fillColor(GREY).font("Helvetica")
      .text(`Édité le ${stamp}`, m, y, { width: 250, lineBreak: false })
      .text(
        `Page ${i - range.start + 1} / ${range.count}`,
        doc.page.width - m - 100, y,
        { width: 100, align: "right", lineBreak: false },
      );

    doc.page.margins.bottom = bottom;
  }
}

/** Bas de zone utile : marge basse + bandeau de pied de page. */
function contentBottom(doc: Doc) {
  return doc.page.height - doc.page.margins.bottom - 24;
}

/**
 * Garantit `needed` points disponibles avant d'écrire.
 * Sans cela, pdfkit fait déborder le texte sur une page supplémentaire
 * dès que le curseur approche du bas.
 */
function ensureSpace(doc: Doc, needed: number) {
  if (doc.y + needed > contentBottom(doc)) {
    doc.addPage();
    doc.x = doc.page.margins.left;
    doc.y = doc.page.margins.top;
  }
}

function sectionTitle(doc: Doc, text: string) {
  const m = doc.page.margins.left;
  ensureSpace(doc, 60);
  // Les blocs positionnés en absolu laissent `x` décalé : on le ramène à la marge,
  // sinon le texte se replie dans une colonne étroite et déborde sur plusieurs pages.
  doc.x = m;
  doc.moveDown(0.6);
  doc.fontSize(11).font("Helvetica-Bold").fillColor(BLUE)
    .text(text, m, doc.y, { width: doc.page.width - 2 * m });
  doc.moveTo(m, doc.y + 2).lineTo(doc.page.width - m, doc.y + 2)
    .strokeColor(BLUE).lineWidth(0.8).stroke();
  doc.moveDown(0.5).fillColor("#000000");
  doc.x = m;
}

/** Grille clé/valeur sur deux colonnes. */
function infoGrid(doc: Doc, rows: [string, string][]) {
  const m = doc.page.margins.left;
  const colW = (doc.page.width - 2 * m) / 2;
  let i = 0;
  for (const [label, value] of rows) {
    const col = i % 2;
    const x = m + col * colW;
    if (col === 0 && i > 0) doc.moveDown(0.1);
    const y = doc.y;
    doc.fontSize(7.5).fillColor(GREY).font("Helvetica").text(label, x, y, { width: colW - 10 });
    doc.fontSize(9).fillColor("#000000").font("Helvetica-Bold")
      .text(value || "—", x, y + 10, { width: colW - 10 });
    if (col === 1 || i === rows.length - 1) doc.y = y + 26;
    else doc.y = y;
    i++;
  }
  doc.x = m;
}

/** Tableau simple avec en-tête coloré et alternance de fond. */
function table(
  doc: Doc,
  headers: string[],
  widths: number[],
  rows: (string | number)[][],
  opts?: { highlight?: (r: number) => boolean; align?: ("left" | "right")[] },
) {
  const startX = doc.page.margins.left;
  const rowH = 16;

  const drawHeader = () => {
    const y = doc.y;
    doc.rect(startX, y, widths.reduce((a, b) => a + b, 0), rowH).fill(BLUE);
    let x = startX;
    headers.forEach((h, i) => {
      doc.fillColor("#ffffff").fontSize(7.5).font("Helvetica-Bold")
        .text(h, x + 3, y + 5, { width: widths[i] - 6, align: opts?.align?.[i] ?? "left" });
      x += widths[i];
    });
    doc.y = y + rowH;
    doc.fillColor("#000000");
  };

  drawHeader();

  rows.forEach((row, ri) => {
    if (doc.y + rowH > contentBottom(doc)) {
      doc.addPage();
      doc.x = startX;
      doc.y = doc.page.margins.top;
      drawHeader();
    }
    const y = doc.y;
    const total = widths.reduce((a, b) => a + b, 0);
    if (opts?.highlight?.(ri)) doc.rect(startX, y, total, rowH).fill("#fde7e9");
    else if (ri % 2 === 0) doc.rect(startX, y, total, rowH).fill(LIGHT);

    let x = startX;
    row.forEach((cell, i) => {
      doc.fillColor("#000000").fontSize(7.5).font("Helvetica")
        .text(String(cell), x + 3, y + 5, {
          width: widths[i] - 6,
          align: opts?.align?.[i] ?? "left",
          ellipsis: true,
          lineBreak: false,
        });
      x += widths[i];
    });
    doc.y = y + rowH;
  });
  doc.x = startX;
  doc.moveDown(0.5);
}

/** Fiche complète d'un ordre de fabrication. */
export async function buildOrderPdf(orderId: string, usines?: string[] | null): Promise<Buffer> {
  const order = await prisma.productionOrder.findFirst({
    where: { id: orderId, ...(usines ? { store: { unite: { in: usines } } } : {}) },
    include: {
      article: true, store: true,
      productionLines: { include: { enteredBy: { select: { fullName: true } } } },
      qualityControls: { include: { enteredBy: { select: { fullName: true } } } },
      nonConformities: true,
      comments: { include: { author: { select: { fullName: true } } }, orderBy: { createdAt: "asc" } },
      createdBy: { select: { fullName: true } },
    },
  });
  if (!order) throw new Error("OF introuvable");

  const line = order.productionLines[0];
  const qc = order.qualityControls[0];
  const rec = reconcile(
    { qteProduite: line?.qteProduite ?? 0, qteBonne: line?.qteBonne ?? 0, qteRebut: line?.qteRebut ?? 0 },
    { qteControlee: qc?.qteControlee ?? 0, qteConforme: qc?.qteConforme ?? 0, qteNonConforme: qc?.qteNonConforme ?? 0 },
  );

  return render((doc) => {
    header(doc, `Ordre de fabrication ${order.number}`, ORDER_STATUS[order.status].label);

    sectionTitle(doc, "Informations générales");
    infoGrid(doc, [
      ["Article", `${order.article.designation} (${order.article.code})`],
      ["Famille", order.article.family ?? "—"],
      ["Magasin", `${order.store.designation} (${order.store.code})`],
      ["Ligne / Atelier", order.atelier ?? "—"],
      ["Équipe", order.equipe ?? "—"],
      ["Chef d'équipe", order.chefEquipe ?? "—"],
      ["Date début", formatDate(order.dateDebut)],
      ["Date fin prévue", formatDate(order.dateFinPrev)],
      ["Créé par", order.createdBy.fullName],
      ["Créé le", formatDateTime(order.createdAt)],
    ]);

    sectionTitle(doc, "Saisie production");
    table(
      doc,
      ["Qté prévue", "Qté produite", "Qté bonne", "Qté rebut", "Taux rebut", "Cause (5M)"],
      [70, 70, 70, 70, 65, 170],
      [[
        formatNumber(line?.qtePrevue ?? 0),
        formatNumber(line?.qteProduite ?? 0),
        formatNumber(line?.qteBonne ?? 0),
        formatNumber(line?.qteRebut ?? 0),
        `${formatNumber(line && line.qteProduite > 0 ? (line.qteRebut / line.qteProduite) * 100 : 0, 1)} %`,
        line?.causeRebut ? `${line.causeRebut}${line.causeRebutM5 ? ` (${line.causeRebutM5})` : ""}` : "—",
      ]],
      { align: ["right", "right", "right", "right", "right", "left"] },
    );
    if (order.productionValidatedBy) {
      doc.fontSize(8).fillColor(GREY).font("Helvetica")
        .text(`Production validée par ${order.productionValidatedBy} le ${formatDateTime(order.productionValidatedAt)}`);
      doc.fillColor("#000000");
    }

    sectionTitle(doc, "Contrôle qualité");
    if (!qc) {
      doc.fontSize(9).fillColor(GREY).text("Aucun contrôle qualité enregistré.").fillColor("#000000");
    } else {
      table(
        doc,
        ["Qté contrôlée", "Conforme", "Non conforme", "Taux conformité", "Décision", "Contrôleur"],
        [75, 65, 75, 80, 90, 130],
        [[
          formatNumber(qc.qteControlee),
          formatNumber(qc.qteConforme),
          formatNumber(qc.qteNonConforme),
          `${formatNumber(rec.tauxConformite, 1)} %`,
          QUALITY_DECISION[qc.decision].label,
          qc.controleur ?? qc.enteredBy.fullName,
        ]],
        { align: ["right", "right", "right", "right", "left", "left"] },
      );

      const mesures: (string | number)[][] = [
        ["Longueur (mm)", qc.longueur ?? "—"],
        ["Largeur (mm)", qc.largeur ?? "—"],
        ["Hauteur (mm)", qc.hauteur ?? "—"],
        ["Résistance (MPa)", qc.resistance ?? "—"],
        ["Humidité (%)", qc.humidite ?? "—"],
        ["Poids (kg)", qc.poids ?? "—"],
      ];
      table(doc, ["Mesure", "Valeur"], [200, 100], mesures, { align: ["left", "right"] });

      if (order.qualityValidatedBy) {
        doc.fontSize(8).fillColor(GREY)
          .text(`Qualité validée par ${order.qualityValidatedBy} le ${formatDateTime(order.qualityValidatedAt)}`);
        doc.fillColor("#000000");
      }

      sectionTitle(doc, "Écart Production / Qualité");
      table(
        doc,
        ["Déclaration", "Total", "Bon / Conforme", "Rebut / Refusé"],
        [140, 100, 120, 120],
        [
          ["Production", formatNumber(line?.qteProduite ?? 0), formatNumber(line?.qteBonne ?? 0), formatNumber(line?.qteRebut ?? 0)],
          ["Qualité", formatNumber(qc.qteControlee), formatNumber(qc.qteConforme), formatNumber(qc.qteNonConforme)],
          [
            "Écart",
            formatNumber(rec.ecartPresente),
            formatNumber(rec.ecartConforme),
            formatNumber(rec.ecartRebut),
          ],
        ],
        { align: ["left", "right", "right", "right"], highlight: (r) => r === 2 && rec.hasEcart },
      );
      if (rec.hasEcart) {
        doc.fontSize(8).fillColor(RED).font("Helvetica-Bold")
          .text(`Écart ${rec.level === "MAJEUR" ? "majeur" : "mineur"} — ${formatNumber(rec.ecartConformePct, 1)} % de la quantité produite.`);
        doc.fillColor("#000000").font("Helvetica");
      }
    }

    if (order.nonConformities.length > 0) {
      sectionTitle(doc, "Non-conformités");
      table(
        doc,
        ["N° NC", "Nature", "Quantité", "Gravité", "Statut"],
        [80, 210, 60, 70, 80],
        order.nonConformities.map((n) => [
          n.number, n.nature ?? "—", formatNumber(n.quantite), n.gravite, n.status,
        ]),
        { align: ["left", "left", "right", "left", "left"] },
      );
    }

    if (order.comments.length > 0) {
      sectionTitle(doc, "Échanges Production / Qualité");
      table(
        doc,
        ["Date", "Auteur", "Message"],
        [90, 110, 300],
        order.comments.map((c) => [formatDateTime(c.createdAt), c.author.fullName, c.content]),
      );
    }

    ensureSpace(doc, 110);
    sectionTitle(doc, "Visas");
    const m = doc.page.margins.left;
    const y = doc.y + 4;
    const w = (doc.page.width - 2 * m) / 3;
    ["Responsable Production", "Responsable Qualité", "Direction Générale"].forEach((label, i) => {
      const x = m + i * w;
      doc.rect(x, y, w - 10, 55).strokeColor("#cccccc").lineWidth(0.7).stroke();
      doc.fontSize(7.5).fillColor(GREY).text(label, x + 5, y + 4, { width: w - 20 });
    });
    doc.y = y + 65;
  });
}

/**
 * Fiche planning de production — format paysage, à afficher en atelier.
 * Reprend le diagramme de Gantt de l'écran : une bande par atelier,
 * une barre par OF positionnée sur l'horizon.
 */
export async function buildPlanningPdf(options?: {
  from?: Date;
  to?: Date;
  days?: number;
  usines?: string[] | null;
}): Promise<Buffer> {
  const data = await getPlanning(options);

  // Couleurs de barre alignées sur l'écran
  const barColor = (status: string, late: boolean) => {
    if (late) return "#c0392b";
    if (status === "QUALITY_VALIDATED") return "#16a34a";
    if (status === "PRODUCTION_VALIDATED") return "#e08e0b";
    return "#2563eb";
  };
  const PRIO_MARK: Record<string, string> = {
    URGENTE: "!! ", HAUTE: "! ", NORMALE: "", BASSE: "",
  };

  return render(
    (doc) => {
      const m = doc.page.margins.left;
      const usable = doc.page.width - 2 * m;
      const labelW = 105;
      const gridX = m + labelW;
      const gridW = usable - labelW;
      const colW = gridW / data.days.length;

      header(
        doc,
        "Planning de production",
        `Du ${formatDate(data.from)} au ${formatDate(data.to)} — ${data.totalOrders} OF actifs` +
          (data.usines ? ` · ${data.usines.join(", ")}` : " · toutes usines"),
      );

      // ── En-tête calendrier ──────────────────────────
      const headTop = doc.y;
      doc.rect(m, headTop, usable, 22).fill(BLUE);
      doc.fillColor("#ffffff").fontSize(7.5).font("Helvetica-Bold")
        .text("ATELIER / LIGNE", m + 4, headTop + 8, { width: labelW - 8 });

      data.days.forEach((d, i) => {
        const x = gridX + i * colW;
        if (d.isWeekend) doc.rect(x, headTop, colW, 22).fill("#163a6b");
        doc.fillColor("#ffffff").fontSize(6).font("Helvetica")
          .text(d.dayName, x, headTop + 4, { width: colW, align: "center" });
        doc.fontSize(7).font("Helvetica-Bold")
          .text(d.label, x, headTop + 12, { width: colW, align: "center" });
      });
      doc.y = headTop + 22;

      // ── Bandes par atelier ──────────────────────────
      const barH = 11;
      const gap = 3;

      for (const a of data.ateliers) {
        const rows = Math.max(1, a.orders.length);
        const bandH = rows * (barH + gap) + gap;

        ensureSpace(doc, bandH);
        const top = doc.y;

        // Trame de fond : week-ends grisés, séparateurs de jours
        data.days.forEach((d, i) => {
          const x = gridX + i * colW;
          if (d.isWeekend) doc.rect(x, top, colW, bandH).fill("#eef1f5");
          doc.moveTo(x, top).lineTo(x, top + bandH).strokeColor("#dde3ea").lineWidth(0.4).stroke();
        });
        doc.moveTo(m, top + bandH).lineTo(m + usable, top + bandH)
          .strokeColor("#c8d0da").lineWidth(0.5).stroke();

        // Libellé atelier + charge
        doc.fillColor("#000000").fontSize(8).font("Helvetica-Bold")
          .text(a.atelier, m + 4, top + 4, { width: labelW - 8, ellipsis: true, lineBreak: false });
        doc.fillColor(GREY).fontSize(6).font("Helvetica")
          .text(
            `${a.orders.length} OF · ${formatNumber(a.chargePrevue)} prévus`,
            m + 4, top + 14, { width: labelW - 8, lineBreak: false },
          );

        // Barres des OF
        a.orders.forEach((o, idx) => {
          const y = top + gap + idx * (barH + gap);
          const x = gridX + o.startIndex * colW;
          const w = Math.max(o.span * colW - 2, 12);
          doc.roundedRect(x + 1, y, w, barH, 2).fill(barColor(o.status, o.late));
          doc.fillColor("#ffffff").fontSize(6).font("Helvetica-Bold")
            .text(
              `${PRIO_MARK[o.priorite] ?? ""}${o.number} · ${formatNumber(o.avancement, 0)}%`,
              x + 4, y + 3,
              { width: w - 6, ellipsis: true, lineBreak: false },
            );
        });

        doc.fillColor("#000000");
        doc.x = m;
        doc.y = top + bandH;
      }

      // ── Légende ─────────────────────────────────────
      doc.moveDown(0.6);
      const legend: [string, string][] = [
        ["#2563eb", "En production"],
        ["#e08e0b", "Production validée"],
        ["#16a34a", "Qualité validée"],
        ["#c0392b", "En retard"],
      ];
      let lx = m;
      const ly = doc.y;
      for (const [color, label] of legend) {
        doc.rect(lx, ly, 8, 8).fill(color);
        doc.fillColor(GREY).fontSize(7).font("Helvetica").text(label, lx + 11, ly + 1, { lineBreak: false });
        lx += 24 + doc.widthOfString(label);
      }
      doc.fillColor(GREY).fontSize(7)
        .text("  !! urgent   ! prioritaire", lx + 6, ly + 1, { lineBreak: false });
      doc.fillColor("#000000");
      doc.x = m;
      doc.y = ly + 16;

      // ── Détail des ordres planifiés ─────────────────
      sectionTitle(doc, "Détail des ordres planifiés");
      const rows: (string | number)[][] = [];
      for (const a of data.ateliers) {
        for (const o of a.orders) {
          rows.push([
            o.number,
            o.articleDesignation,
            a.atelier,
            o.equipe ?? "—",
            o.chefEquipe ?? "—",
            formatDate(o.dateDebut),
            formatDate(o.dateFinPrev),
            formatNumber(o.qtePrevue),
            formatNumber(o.qteProduite),
            `${formatNumber(o.avancement, 0)} %`,
            o.priorite,
            o.late ? "En retard" : ORDER_STATUS[o.status].label,
          ]);
        }
      }
      if (rows.length === 0) {
        doc.fontSize(9).fillColor(GREY)
          .text("Aucun ordre planifié sur cette période.").fillColor("#000000");
      } else {
        table(
          doc,
          ["N° OF", "Article", "Atelier", "Équipe", "Chef", "Début", "Fin prévue", "Prévu", "Produit", "Avanc.", "Priorité", "Statut"],
          [62, 150, 62, 58, 58, 48, 50, 38, 40, 36, 45, 70],
          rows,
          {
            align: ["left", "left", "left", "left", "left", "left", "left", "right", "right", "right", "left", "left"],
            highlight: (i) => rows[i][11] === "En retard",
          },
        );
      }

      // ── OF non planifiés ────────────────────────────
      if (data.unplanned.length > 0) {
        sectionTitle(doc, `OF non planifiés (${data.unplanned.length})`);
        doc.fontSize(8).fillColor(GREY).font("Helvetica")
          .text("Ces ordres n'ont pas de dates et n'apparaissent dans aucune charge d'atelier.")
          .fillColor("#000000");
        doc.moveDown(0.3);
        table(
          doc,
          ["N° OF", "Article", "Atelier", "Statut"],
          [80, 260, 110, 110],
          data.unplanned.map((o) => [
            o.number, o.articleDesignation, o.atelier, ORDER_STATUS[o.status].label,
          ]),
        );
      }

      // ── Visas ───────────────────────────────────────
      ensureSpace(doc, 110);
      sectionTitle(doc, "Visas");
      const vy = doc.y + 4;
      const vw = usable / 3;
      ["Responsable Production", "Responsable Gestion Production", "Direction Générale"].forEach(
        (label, i) => {
          const x = m + i * vw;
          doc.rect(x, vy, vw - 12, 50).strokeColor("#cccccc").lineWidth(0.7).stroke();
          doc.fontSize(7).fillColor(GREY).text(label, x + 5, vy + 4, { width: vw - 22 });
        },
      );
      doc.y = vy + 58;
    },
    { landscape: true, margin: 30 },
  );
}

/** Rapport de synthèse Direction : KPI, performance, écarts. */
export async function buildSynthesisPdf(usines?: string[] | null): Promise<Buffer> {
  const [data, ecarts] = await Promise.all([
    getDashboardData(usines),
    getEcarts({ onlyWithEcart: true, usines }),
  ]);

  return render((doc) => {
    header(doc, "Rapport de synthèse", "Direction Générale");

    sectionTitle(doc, "Indicateurs clés");
    infoGrid(doc, [
      ["Ordres en cours", formatNumber(data.kpis.inProgress)],
      ["Ordres clôturés", formatNumber(data.kpis.completed)],
      ["Quantité bonne", formatNumber(data.kpis.qteBonne)],
      ["Quantité rebut", formatNumber(data.kpis.qteRebut)],
      ["Taux de rebut", `${formatNumber(data.kpis.tauxRebut, 1)} %`],
      ["Rendement", `${formatNumber(data.kpis.rendement, 1)} %`],
      ["Non-conformités ouvertes", formatNumber(data.kpis.openNc)],
      ["Taux de concordance Prod./Qualité", `${formatNumber(data.kpis.tauxConcordance, 1)} %`],
    ]);

    if (data.perfAtelier.length > 0) {
      sectionTitle(doc, "Performance par atelier / ligne");
      table(
        doc,
        ["Atelier", "OF", "Produit", "Rebut", "Taux rebut", "Rendement"],
        [140, 50, 80, 70, 80, 95],
        data.perfAtelier.map((a) => [
          a.name, a.ordres, formatNumber(a.produite), formatNumber(a.rebut),
          `${formatNumber(a.tauxRebut, 1)} %`, `${formatNumber(a.rendement, 1)} %`,
        ]),
        { align: ["left", "right", "right", "right", "right", "right"] },
      );
    }

    if (data.perfEquipe.length > 0) {
      sectionTitle(doc, "Performance par équipe");
      table(
        doc,
        ["Équipe", "OF", "Produit", "Rebut", "Taux rebut", "Rendement"],
        [140, 50, 80, 70, 80, 95],
        data.perfEquipe.map((a) => [
          a.name, a.ordres, formatNumber(a.produite), formatNumber(a.rebut),
          `${formatNumber(a.tauxRebut, 1)} %`, `${formatNumber(a.rendement, 1)} %`,
        ]),
        { align: ["left", "right", "right", "right", "right", "right"] },
      );
    }

    if (data.defectByM5.length > 0) {
      sectionTitle(doc, "Rebuts par axe 5M (Ishikawa)");
      const total = data.defectByM5.reduce((s, d) => s + d.value, 0) || 1;
      table(
        doc,
        ["Axe 5M", "Quantité rebut", "Part"],
        [200, 120, 100],
        data.defectByM5.map((d) => [
          d.name, formatNumber(d.value), `${formatNumber((d.value / total) * 100, 1)} %`,
        ]),
        { align: ["left", "right", "right"] },
      );
    }

    if (data.defectPareto.length > 0) {
      sectionTitle(doc, "Pareto des causes de rebut");
      const total = data.defectPareto.reduce((s, d) => s + d.value, 0) || 1;
      let cumul = 0;
      table(
        doc,
        ["Cause", "Quantité", "Part", "Cumul"],
        [240, 80, 70, 70],
        data.defectPareto.map((d) => {
          cumul += d.value;
          return [
            d.cause, formatNumber(d.value),
            `${formatNumber((d.value / total) * 100, 1)} %`,
            `${formatNumber((cumul / total) * 100, 1)} %`,
          ];
        }),
        { align: ["left", "right", "right", "right"] },
      );
    }

    sectionTitle(doc, "Écarts Production / Qualité");
    if (ecarts.rows.length === 0) {
      doc.fontSize(9).fillColor(GREY)
        .text("Aucun écart : les validations Qualité concordent avec les déclarations Production.")
        .fillColor("#000000");
    } else {
      table(
        doc,
        ["N° OF", "Article", "Atelier", "Prod. bonne", "Qual. conforme", "Écart", "Niveau"],
        [75, 145, 70, 65, 70, 50, 50],
        ecarts.rows.map((r) => [
          r.number, r.articleDesignation, r.atelier ?? "—",
          formatNumber(r.production.bonne), formatNumber(r.qualite.conforme),
          formatNumber(r.rec.ecartConforme),
          r.rec.level === "MAJEUR" ? "Majeur" : "Mineur",
        ]),
        {
          align: ["left", "left", "left", "right", "right", "right", "left"],
          highlight: (i) => ecarts.rows[i].rec.level === "MAJEUR",
        },
      );
    }
  });
}
