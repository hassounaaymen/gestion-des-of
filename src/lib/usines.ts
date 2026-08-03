/**
 * Correspondance entre les unités de production Business Central
 * (magasins produits finis `MAGPF-U1` … `MAGPF-U6`) et le nom de l'usine.
 *
 * Chaque unité est bâtie autour d'une presse : le nom d'usage de l'usine est
 * celui de sa ligne. Ces noms recoupent exactement les lignes déduites du
 * groupe compta produit de l'ERP (`PF-QUADRA`, `PF-VIFESA`, …), ce qui aligne
 * le vocabulaire du planning (atelier) et celui du filtre (usine).
 */
export const USINE_LABELS: Record<string, string> = {
  U1: "QUADRA",
  U2: "VIFESA",
  U3: "PRENSOLAND",
  U4: "COMPACTA",
  U5: "FERAILLAGE",
  U6: "DEMA",
};

/**
 * Extrait le numéro d'unité d'un code magasin.
 * Tolère les variantes rencontrées : `MAGPF-U1`, `MAGU1`, `MAG-U1`, `MGPF-U1`.
 */
const UNIT_CODE = /^MA?G(?:PF)?-?U(\d+)$/i;

export function uniteFromStoreCode(code: string): string | null {
  const m = UNIT_CODE.exec(code.trim().toUpperCase());
  return m ? m[1] : null;
}

/** Nom d'usage de l'usine pour un numéro d'unité (« 1 » → « QUADRA »). */
export function usineLabel(numero: string): string {
  return USINE_LABELS[`U${numero}`] ?? `Unité ${numero}`;
}

/**
 * Rattachement d'un compte à une ou plusieurs usines.
 *
 * Le stockage est une liste séparée par des virgules plutôt qu'une table de
 * liaison : SQLite/Turso ne sait pas indexer un tableau, et le nombre de
 * comptes est trop faible pour que le filtrage en mémoire coûte quoi que ce
 * soit. `null` signifie « toutes les usines », y compris celles créées plus
 * tard — c'est ce que choisit l'option « Toutes les usines ».
 */
export function parseUsines(csv: string | null | undefined): string[] | null {
  const liste = (csv ?? "")
    .split(",")
    .map((u) => u.trim())
    .filter(Boolean);
  return liste.length > 0 ? liste : null;
}

/** Sérialise pour la base ; une liste vide devient `null` (= toutes les usines). */
export function serializeUsines(
  liste: readonly string[] | null | undefined,
): string | null {
  const propre = Array.from(
    new Set((liste ?? []).map((u) => u.trim()).filter(Boolean)),
  ).sort();
  return propre.length > 0 ? propre.join(",") : null;
}

/**
 * `cible` est-elle contenue dans `portee` ?
 * `null` valant « toutes les usines », il englobe tout et n'est englobé que
 * par lui-même : un administrateur restreint ne peut pas accorder un accès
 * plus large que le sien.
 */
export function usinesIncluses(
  cible: string[] | null,
  portee: string[] | null,
): boolean {
  if (portee === null) return true;
  if (cible === null) return false;
  return cible.every((u) => portee.includes(u));
}

/** Libellé lisible d'un rattachement. */
export function usinesLabel(liste: string[] | null): string {
  return liste === null ? "Toutes les usines" : liste.join(", ");
}
