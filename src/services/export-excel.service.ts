import ExcelJS from "exceljs";
import { prisma } from "@/lib/prisma";
import { getEcarts } from "./ecarts.service";
import { ORDER_STATUS, QUALITY_DECISION } from "@/lib/status";

/**
 * Génération des classeurs Excel.
 * Mise en forme professionnelle : en-tête société, colonnes figées,
 * filtres automatiques et totaux — exploitable directement par la Direction.
 */

const HEADER_FILL = "FF1E4E8C"; // bleu Dynamics
const TITLE = "BEST BÉTON — Gestion des Ordres de Fabrication";

function styleHeader(row: ExcelJS.Row) {
  row.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 10 };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: HEADER_FILL } };
    cell.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
    cell.border = {
      top: { style: "thin" }, left: { style: "thin" },
      bottom: { style: "thin" }, right: { style: "thin" },
    };
  });
  row.height = 28;
}

function addTitle(ws: ExcelJS.Worksheet, subtitle: string, span: number) {
  ws.mergeCells(1, 1, 1, span);
  const t = ws.getCell(1, 1);
  t.value = TITLE;
  t.font = { bold: true, size: 14, color: { argb: HEADER_FILL } };
  t.alignment = { horizontal: "left", vertical: "middle" };
  ws.getRow(1).height = 22;

  ws.mergeCells(2, 1, 2, span);
  const s = ws.getCell(2, 1);
  s.value = `${subtitle} — édité le ${new Date().toLocaleString("fr-FR")}`;
  s.font = { size: 9, italic: true, color: { argb: "FF666666" } };
  ws.getRow(3).height = 6;
}

function finalize(ws: ExcelJS.Worksheet, headerRowNumber: number, span: number) {
  ws.autoFilter = {
    from: { row: headerRowNumber, column: 1 },
    to: { row: headerRowNumber, column: span },
  };
  ws.views = [{ state: "frozen", ySplit: headerRowNumber }];
}

/** Classeur « Ordres de fabrication » avec détail production et qualité. */
export async function buildOrdersWorkbook(): Promise<ExcelJS.Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "Gestion des OF";
  wb.created = new Date();

  const orders = await prisma.productionOrder.findMany({
    include: {
      article: true, store: true,
      productionLines: true, qualityControls: true,
      createdBy: { select: { fullName: true } },
    },
    orderBy: { date: "desc" },
  });

  const ws = wb.addWorksheet("Ordres de fabrication", {
    pageSetup: { orientation: "landscape", fitToPage: true, fitToWidth: 1, fitToHeight: 0 },
  });

  const columns = [
    { header: "N° OF", key: "number", width: 16 },
    { header: "Date", key: "date", width: 12 },
    { header: "Code article", key: "code", width: 18 },
    { header: "Désignation", key: "designation", width: 34 },
    { header: "Famille", key: "family", width: 16 },
    { header: "Magasin", key: "store", width: 26 },
    { header: "Atelier", key: "atelier", width: 14 },
    { header: "Équipe", key: "equipe", width: 14 },
    { header: "Chef d'équipe", key: "chef", width: 16 },
    { header: "Statut", key: "status", width: 20 },
    { header: "Qté prévue", key: "prevue", width: 11 },
    { header: "Qté produite", key: "produite", width: 12 },
    { header: "Qté bonne", key: "bonne", width: 11 },
    { header: "Qté rebut", key: "rebut", width: 11 },
    { header: "Taux rebut %", key: "tauxRebut", width: 12 },
    { header: "Cause rebut", key: "cause", width: 28 },
    { header: "Axe 5M", key: "m5", width: 14 },
    { header: "Qté contrôlée", key: "controlee", width: 13 },
    { header: "Qté conforme", key: "conforme", width: 12 },
    { header: "Qté non conforme", key: "nonConforme", width: 15 },
    { header: "Décision qualité", key: "decision", width: 18 },
    { header: "Écart Prod/Qualité", key: "ecart", width: 17 },
    { header: "Créé par", key: "createdBy", width: 22 },
  ];

  addTitle(ws, "Registre des ordres de fabrication", columns.length);
  const headerRow = ws.getRow(4);
  columns.forEach((c, i) => {
    headerRow.getCell(i + 1).value = c.header;
    ws.getColumn(i + 1).width = c.width;
  });
  styleHeader(headerRow);

  let r = 5;
  for (const o of orders) {
    const p = o.productionLines.reduce(
      (a, l) => ({
        prevue: a.prevue + l.qtePrevue,
        produite: a.produite + l.qteProduite,
        bonne: a.bonne + l.qteBonne,
        rebut: a.rebut + l.qteRebut,
      }),
      { prevue: 0, produite: 0, bonne: 0, rebut: 0 },
    );
    const q = o.qualityControls.reduce(
      (a, c) => ({
        controlee: a.controlee + c.qteControlee,
        conforme: a.conforme + c.qteConforme,
        nonConforme: a.nonConforme + c.qteNonConforme,
      }),
      { controlee: 0, conforme: 0, nonConforme: 0 },
    );
    const line = o.productionLines[0];
    const qc = o.qualityControls[0];

    ws.getRow(r).values = [
      o.number,
      o.date,
      o.article.code,
      o.article.designation,
      o.article.family ?? "",
      `${o.store.designation} (${o.store.code})`,
      o.atelier ?? "",
      o.equipe ?? "",
      o.chefEquipe ?? "",
      ORDER_STATUS[o.status].label,
      p.prevue, p.produite, p.bonne, p.rebut,
      p.produite > 0 ? (p.rebut / p.produite) * 100 : 0,
      line?.causeRebut ?? "",
      line?.causeRebutM5 ?? "",
      q.controlee, q.conforme, q.nonConforme,
      qc ? QUALITY_DECISION[qc.decision].label : "",
      q.controlee > 0 ? q.conforme - p.bonne : "",
      o.createdBy.fullName,
    ];
    const row = ws.getRow(r);
    row.getCell(2).numFmt = "dd/mm/yyyy";
    [11, 12, 13, 14, 18, 19, 20, 22].forEach((c) => (row.getCell(c).numFmt = "#,##0"));
    row.getCell(15).numFmt = "0.0";
    // Signale visuellement un écart Production / Qualité
    const ecart = row.getCell(22).value;
    if (typeof ecart === "number" && ecart !== 0) {
      row.getCell(22).font = { bold: true, color: { argb: "FFC00000" } };
    }
    r++;
  }

  // Ligne de totaux
  if (orders.length > 0) {
    const totalRow = ws.getRow(r);
    totalRow.getCell(10).value = "TOTAL";
    [11, 12, 13, 14, 18, 19, 20].forEach((c) => {
      const col = ws.getColumn(c).letter;
      totalRow.getCell(c).value = { formula: `SUM(${col}5:${col}${r - 1})` };
      totalRow.getCell(c).numFmt = "#,##0";
    });
    totalRow.eachCell((cell) => {
      cell.font = { bold: true };
      cell.border = { top: { style: "double" } };
    });
  }

  finalize(ws, 4, columns.length);
  return wb.xlsx.writeBuffer();
}

/** Classeur « Écarts Production / Qualité » pour la Direction. */
export async function buildEcartsWorkbook(): Promise<ExcelJS.Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "Gestion des OF";
  const data = await getEcarts();

  const ws = wb.addWorksheet("Écarts Prod-Qualité", {
    pageSetup: { orientation: "landscape", fitToPage: true, fitToWidth: 1 },
  });

  const headers = [
    "N° OF", "Date", "Article", "Atelier", "Équipe",
    "Prod. produite", "Prod. bonne", "Qual. contrôlée", "Qual. conforme",
    "Écart", "Écart %", "Niveau", "Taux conformité %", "Décision", "Contrôleur",
  ];
  const widths = [16, 12, 34, 14, 14, 13, 12, 14, 13, 10, 10, 12, 16, 18, 22];

  addTitle(ws, "Écarts entre déclaration Production et validation Qualité", headers.length);
  const headerRow = ws.getRow(4);
  headers.forEach((h, i) => {
    headerRow.getCell(i + 1).value = h;
    ws.getColumn(i + 1).width = widths[i];
  });
  styleHeader(headerRow);

  let r = 5;
  for (const row of data.rows) {
    ws.getRow(r).values = [
      row.number, row.date, row.articleDesignation, row.atelier ?? "", row.equipe ?? "",
      row.production.produite, row.production.bonne,
      row.qualite.controlee, row.qualite.conforme,
      row.rec.ecartConforme, row.rec.ecartConformePct,
      row.rec.level === "AUCUN" ? "—" : row.rec.level === "MAJEUR" ? "Majeur" : "Mineur",
      row.rec.tauxConformite,
      row.decision ? QUALITY_DECISION[row.decision].label : "",
      row.controleur ?? "",
    ];
    const cur = ws.getRow(r);
    cur.getCell(2).numFmt = "dd/mm/yyyy";
    [6, 7, 8, 9, 10].forEach((c) => (cur.getCell(c).numFmt = "#,##0"));
    [11, 13].forEach((c) => (cur.getCell(c).numFmt = "0.0"));
    if (row.rec.level === "MAJEUR") {
      cur.eachCell((cell) => {
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFDE7E9" } };
      });
      cur.getCell(10).font = { bold: true, color: { argb: "FFC00000" } };
    }
    r++;
  }

  // Synthèse
  r += 1;
  const summary: [string, string | number][] = [
    ["OF contrôlés", data.totalControles],
    ["OF avec écart", data.avecEcart],
    ["Écarts majeurs", data.majeurs],
    ["Taux de concordance (%)", Number(data.tauxConcordance.toFixed(1))],
    ["Quantité d'écart cumulée", data.qteEcartConforme],
  ];
  for (const [label, value] of summary) {
    ws.getCell(r, 1).value = label;
    ws.getCell(r, 1).font = { bold: true };
    ws.getCell(r, 2).value = value;
    r++;
  }

  finalize(ws, 4, headers.length);
  return wb.xlsx.writeBuffer();
}

/** Classeur « Non-conformités ». */
export async function buildNcWorkbook(): Promise<ExcelJS.Buffer> {
  const wb = new ExcelJS.Workbook();
  const list = await prisma.nonConformity.findMany({
    include: { order: true, article: true, responsable: { select: { fullName: true } } },
    orderBy: { date: "desc" },
  });

  const ws = wb.addWorksheet("Non-conformités", {
    pageSetup: { orientation: "landscape", fitToPage: true, fitToWidth: 1 },
  });
  const headers = [
    "N° NC", "Date", "N° OF", "Code article", "Désignation",
    "Nature", "Quantité", "Gravité", "Cause", "Action corrective", "Responsable", "Statut",
  ];
  const widths = [16, 12, 16, 18, 32, 36, 10, 12, 28, 32, 22, 14];

  addTitle(ws, "Registre des non-conformités", headers.length);
  const headerRow = ws.getRow(4);
  headers.forEach((h, i) => {
    headerRow.getCell(i + 1).value = h;
    ws.getColumn(i + 1).width = widths[i];
  });
  styleHeader(headerRow);

  let r = 5;
  for (const nc of list) {
    ws.getRow(r).values = [
      nc.number, nc.date, nc.order.number, nc.article.code, nc.article.designation,
      nc.nature ?? "", nc.quantite, nc.gravite, nc.cause ?? "",
      nc.actionCorrective ?? "", nc.responsable?.fullName ?? "", nc.status,
    ];
    ws.getRow(r).getCell(2).numFmt = "dd/mm/yyyy";
    ws.getRow(r).getCell(7).numFmt = "#,##0";
    if (nc.gravite === "CRITIQUE") {
      ws.getRow(r).getCell(8).font = { bold: true, color: { argb: "FFC00000" } };
    }
    r++;
  }

  finalize(ws, 4, headers.length);
  return wb.xlsx.writeBuffer();
}
