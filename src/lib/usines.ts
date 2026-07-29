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
