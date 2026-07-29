import { prisma } from "@/lib/prisma";
import { ItemType, StoreType } from "@prisma/client";
import { usineLabel, uniteFromStoreCode } from "@/lib/usines";

/**
 * Intégration Microsoft Dynamics NAV / Business Central — OData V4.
 *
 * Endpoint : {ERP_BASE_URL}/Company('{ERP_COMPANY}')/{entité}
 * Auth     : Basic (NavUserPassword)
 *
 * Les Articles et Magasins sont en LECTURE SEULE côté application :
 * ils proviennent exclusivement de l'ERP et ne sont jamais modifiés ici.
 */

// ── Formes brutes renvoyées par l'ERP ────────────────────────
interface BcItem {
  No: string;
  Description?: string;
  Search_Description?: string;
  Inventory_Posting_Group?: string;
  Gen_Prod_Posting_Group?: string;
  Base_Unit_of_Measure?: string;
}

interface BcLedgerEntry {
  Location_Code?: string;
}

interface ODataPage<T> {
  value: T[];
  "@odata.nextLink"?: string;
}

export class ErpNotConfiguredError extends Error {
  constructor() {
    super("Connexion ERP non configurée (ERP_BASE_URL / ERP_USER / ERP_PASSWORD)");
  }
}

function erpConfig() {
  const baseUrl = process.env.ERP_BASE_URL;
  const company = process.env.ERP_COMPANY;
  const user = process.env.ERP_USER;
  const password = process.env.ERP_PASSWORD;
  if (!baseUrl || !company || !user || !password) return null;
  return { baseUrl: baseUrl.replace(/\/$/, ""), company, user, password };
}

export function isErpConfigured() {
  return erpConfig() !== null;
}

/** Construit l'URL d'une entité de la société courante. */
function entityUrl(entity: string, query = "") {
  const cfg = erpConfig()!;
  const company = encodeURIComponent(cfg.company).replace(/%20/g, "%20");
  return `${cfg.baseUrl}/Company('${company}')/${entity}${query ? `?${query}` : ""}`;
}

/** Récupère toutes les pages d'une entité OData (suit @odata.nextLink). */
async function fetchAll<T>(entity: string, query = "", maxPages = 20): Promise<T[]> {
  const cfg = erpConfig();
  if (!cfg) throw new ErpNotConfiguredError();

  const auth = Buffer.from(`${cfg.user}:${cfg.password}`).toString("base64");
  const rows: T[] = [];
  let url: string | undefined = entityUrl(entity, query);
  let page = 0;

  while (url && page < maxPages) {
    const res: Response = await fetch(url, {
      headers: { Authorization: `Basic ${auth}`, Accept: "application/json" },
      cache: "no-store",
      signal: AbortSignal.timeout(120_000),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(
        `ERP ${entity} → HTTP ${res.status}${body ? ` : ${body.slice(0, 200)}` : ""}`,
      );
    }
    const data = (await res.json()) as ODataPage<T>;
    rows.push(...(data.value ?? []));
    url = data["@odata.nextLink"];
    page++;
  }
  return rows;
}

// ── Règles de mapping métier ─────────────────────────────────

/**
 * Déduit la nature de l'article depuis le groupe compta produit de BC.
 * PF-* = produit fini, SF-* = semi-fini, MP = matière première,
 * CNS = consommable, PDR = pièce de rechange.
 */
export function mapItemType(genProdPostingGroup?: string): ItemType {
  const g = (genProdPostingGroup ?? "").trim().toUpperCase();
  if (g.startsWith("PF")) return ItemType.PRODUIT_FINI;
  if (g.startsWith("SF")) return ItemType.SEMI_FINI;
  if (g === "MP") return ItemType.MATIERE_PREMIERE;
  if (g === "CNS") return ItemType.CONSOMMABLE;
  if (g === "PDR") return ItemType.PIECE_RECHANGE;
  return ItemType.AUTRE;
}

/**
 * Déduit la ligne de production (atelier) depuis le suffixe du groupe produit.
 * Ex. "PF-QUADRA" → "QUADRA" (presse à agglos), "SF-FERAILLAGE" → "FERAILLAGE".
 */
export function mapProductionLine(genProdPostingGroup?: string): string | null {
  const g = (genProdPostingGroup ?? "").trim().toUpperCase();
  const m = /^(?:PF|SF)-(.+)$/.exec(g);
  if (!m) return null;
  const line = m[1].trim();
  return line && line !== "DIVERS" ? line : null;
}

/** Seuls les produits finis et semi-finis peuvent faire l'objet d'un OF. */
function isManufacturable(type: ItemType) {
  return type === ItemType.PRODUIT_FINI || type === ItemType.SEMI_FINI;
}

/** Libellé lisible d'un code magasin BC, et unité de production rattachée. */
export function mapStoreLabel(code: string): {
  designation: string;
  type: StoreType;
  unite: string | null;
} {
  const c = code.trim().toUpperCase();

  // MAGPF-U1 … MAGPF-U6 : magasins produits finis rattachés à une usine.
  // L'unité porte le nom de sa presse (ex. U1 → QUADRA).
  const numero = uniteFromStoreCode(c);
  if (numero) {
    const usine = usineLabel(numero);
    return {
      designation: `Magasin Produits Finis — ${usine}`,
      type: StoreType.PRODUIT_FINI,
      unite: usine,
    };
  }

  const KNOWN: Record<string, { designation: string; type: StoreType }> = {
    MGMPAGREGA: { designation: "Magasin MP — Agrégats", type: StoreType.MATIERE_PREMIERE },
    MAGMPCM: { designation: "Magasin MP — Ciment", type: StoreType.MATIERE_PREMIERE },
    MGMPSABSIL: { designation: "Magasin MP — Sable silice", type: StoreType.MATIERE_PREMIERE },
    MAGMPAC: { designation: "Magasin MP — Acier", type: StoreType.MATIERE_PREMIERE },
    MAGMPGEN: { designation: "Magasin MP — Général", type: StoreType.MATIERE_PREMIERE },
    MGBSTBETON: { designation: "Magasin Best Béton", type: StoreType.AUTRE },
    MAGPDR: { designation: "Magasin Pièces de rechange", type: StoreType.AUTRE },
  };
  if (KNOWN[c]) return { ...KNOWN[c], unite: null };

  if (c.startsWith("MAGPF") || c.startsWith("MGPF")) {
    return { designation: `Magasin Produits Finis ${c}`, type: StoreType.PRODUIT_FINI, unite: null };
  }
  if (c.startsWith("MAGMP") || c.startsWith("MGMP")) {
    return {
      designation: `Magasin Matières Premières ${c}`,
      type: StoreType.MATIERE_PREMIERE,
      unite: null,
    };
  }
  return { designation: `Magasin ${c}`, type: StoreType.AUTRE, unite: null };
}

// ── Synchronisation ──────────────────────────────────────────

export interface SyncReport {
  articles: { fetched: number; created: number; updated: number };
  stores: { fetched: number; created: number; updated: number };
  durationMs: number;
}

export const erpService = {
  isConfigured: isErpConfigured,

  /** Vérifie que l'ERP répond (utilisé pour le diagnostic de connexion). */
  async ping(): Promise<{ ok: boolean; count?: number; error?: string }> {
    if (!isErpConfigured()) return { ok: false, error: "ERP non configuré" };
    try {
      const rows = await fetchAll<BcItem>("Item", "$select=No&$top=1", 1);
      return { ok: true, count: rows.length };
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : "Erreur inconnue" };
    }
  },

  /** Importe le catalogue Articles depuis BC (toutes pages). */
  async syncArticles() {
    const raw = await fetchAll<BcItem>(
      "Item",
      "$select=No,Description,Search_Description,Inventory_Posting_Group,Gen_Prod_Posting_Group,Base_Unit_of_Measure",
    );

    const mapped = raw
      .filter((r) => r.No?.trim())
      .map((r) => {
        const itemType = mapItemType(r.Gen_Prod_Posting_Group);
        return {
          code: r.No.trim(),
          designation: (r.Description || r.Search_Description || r.No).trim(),
          family: r.Inventory_Posting_Group?.trim() || null,
          unit: r.Base_Unit_of_Measure?.trim() || null,
          erpCategory: r.Gen_Prod_Posting_Group?.trim() || null,
          productionLine: mapProductionLine(r.Gen_Prod_Posting_Group),
          itemType,
          isManufactured: isManufacturable(itemType),
          status: "Actif",
        };
      });

    const existing = await prisma.article.findMany({
      select: {
        code: true, designation: true, family: true, unit: true,
        erpCategory: true, productionLine: true, itemType: true, isManufactured: true,
      },
    });
    const byCode = new Map(existing.map((a) => [a.code, a]));

    const toCreate = mapped.filter((m) => !byCode.has(m.code));
    const toUpdate = mapped.filter((m) => {
      const cur = byCode.get(m.code);
      if (!cur) return false;
      return (
        cur.designation !== m.designation ||
        cur.family !== m.family ||
        cur.unit !== m.unit ||
        cur.erpCategory !== m.erpCategory ||
        cur.productionLine !== m.productionLine ||
        cur.itemType !== m.itemType ||
        cur.isManufactured !== m.isManufactured
      );
    });

    for (let i = 0; i < toCreate.length; i += 500) {
      await prisma.article.createMany({ data: toCreate.slice(i, i + 500) });
    }
    for (let i = 0; i < toUpdate.length; i += 100) {
      await prisma.$transaction(
        toUpdate.slice(i, i + 100).map((m) =>
          prisma.article.update({
            where: { code: m.code },
            data: { ...m, syncedAt: new Date() },
          }),
        ),
      );
    }

    return { fetched: mapped.length, created: toCreate.length, updated: toUpdate.length };
  },

  /**
   * Les magasins ne sont pas exposés en tant qu'entité dédiée sur ce serveur BC :
   * on les reconstitue à partir des codes emplacement des écritures article.
   */
  async syncStores() {
    const raw = await fetchAll<BcLedgerEntry>(
      "ItemLedgerEntries",
      "$select=Location_Code&$filter=Location_Code ne ''",
      10,
    );

    const codes = Array.from(
      new Set(raw.map((r) => r.Location_Code?.trim()).filter((c): c is string => !!c)),
    ).sort();

    const existing = await prisma.store.findMany({
      select: { code: true, designation: true, type: true, unite: true },
    });
    const byCode = new Map(existing.map((s) => [s.code, s]));

    let created = 0;
    let updated = 0;
    for (const code of codes) {
      const { designation, type, unite } = mapStoreLabel(code);
      const cur = byCode.get(code);
      if (!cur) {
        await prisma.store.create({ data: { code, designation, type, unite } });
        created++;
      } else if (cur.designation !== designation || cur.type !== type || cur.unite !== unite) {
        await prisma.store.update({
          where: { code },
          data: { designation, type, unite, syncedAt: new Date() },
        });
        updated++;
      }
    }
    return { fetched: codes.length, created, updated };
  },

  async syncAll(): Promise<SyncReport> {
    if (!isErpConfigured()) throw new ErpNotConfiguredError();
    const started = Date.now();
    const articles = await this.syncArticles();
    const stores = await this.syncStores();
    return { articles, stores, durationMs: Date.now() - started };
  },
};
