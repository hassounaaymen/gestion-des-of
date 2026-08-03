import type { Prisma } from "@prisma/client";
import { scopeUsines } from "./rbac";
import { usinesLabel } from "./usines";
import type { SessionPayload } from "./session";

/**
 * Cloisonnement des données par usine.
 *
 * L'usine d'un ordre est celle de son magasin de destination (`store.unite`) ;
 * celle d'un article est sa ligne de production ERP (`article.productionLine`),
 * qui porte le même nom (« QUADRA », « VIFESA », …).
 *
 * Un utilisateur rattaché à une ou plusieurs usines ne voit que ces usines ;
 * un rattachement `null` vaut « toutes les usines ».
 *
 * Ces filtres sont appliqués **côté serveur** : masquer un écran ne suffirait
 * pas, il faut que la requête elle-même soit restreinte.
 */

/** Clause à fusionner dans un `where` de ProductionOrder. */
export function orderScope(session: SessionPayload): Prisma.ProductionOrderWhereInput {
  const usines = scopeUsines(session);
  return usines ? { store: { unite: { in: usines } } } : {};
}

/** Clause pour les entités rattachées à un ordre (NC, contrôles…). */
export function viaOrderScope(session: SessionPayload) {
  const usines = scopeUsines(session);
  return usines ? { order: { store: { unite: { in: usines } } } } : {};
}

/** Clause pour les lignes de production. */
export function productionLineScope(session: SessionPayload): Prisma.ProductionLineWhereInput {
  const usines = scopeUsines(session);
  return usines ? { order: { store: { unite: { in: usines } } } } : {};
}

/** Clause pour les magasins visibles. */
export function storeScope(session: SessionPayload): Prisma.StoreWhereInput {
  const usines = scopeUsines(session);
  return usines ? { unite: { in: usines } } : {};
}

/**
 * Clause pour les articles visibles.
 *
 * Un article se rattache à une usine par sa ligne de production, déduite du
 * groupe compta produit de l'ERP (« PF-QUADRA » → « QUADRA »). Les articles
 * sans ligne ne relèvent d'aucune usine : ils sont exclus du périmètre d'un
 * compte rattaché, et ne restent visibles que dans le référentiel brut.
 */
export function articleScope(session: SessionPayload): Prisma.ArticleWhereInput {
  const usines = scopeUsines(session);
  return usines ? { productionLine: { in: usines } } : {};
}

/** Libellé du périmètre courant, pour l'affichage. */
export function scopeLabel(session: SessionPayload): string {
  return usinesLabel(scopeUsines(session));
}
