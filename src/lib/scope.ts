import type { Prisma } from "@prisma/client";
import { scopeUsine } from "./rbac";
import type { SessionPayload } from "./session";

/**
 * Cloisonnement des données par usine.
 *
 * L'usine d'un ordre est celle de son magasin de destination (`store.unite`).
 * Un utilisateur rattaché à une usine ne voit que les ordres de cette usine ;
 * l'informatique et la Direction Générale voient tout.
 *
 * Ces filtres sont appliqués **côté serveur** : masquer un écran ne suffirait
 * pas, il faut que la requête elle-même soit restreinte.
 */

/** Clause à fusionner dans un `where` de ProductionOrder. */
export function orderScope(session: SessionPayload): Prisma.ProductionOrderWhereInput {
  const usine = scopeUsine(session);
  return usine ? { store: { unite: usine } } : {};
}

/** Clause pour les entités rattachées à un ordre (NC, contrôles…). */
export function viaOrderScope(session: SessionPayload) {
  const usine = scopeUsine(session);
  return usine ? { order: { store: { unite: usine } } } : {};
}

/** Clause pour les lignes de production. */
export function productionLineScope(session: SessionPayload): Prisma.ProductionLineWhereInput {
  const usine = scopeUsine(session);
  return usine ? { order: { store: { unite: usine } } } : {};
}

/** Clause pour les magasins visibles. */
export function storeScope(session: SessionPayload): Prisma.StoreWhereInput {
  const usine = scopeUsine(session);
  return usine ? { unite: usine } : {};
}

/**
 * Clause pour la gestion des comptes : un directeur d'usine ne voit et ne
 * modifie que les comptes de son site.
 */
export function userScope(session: SessionPayload): Prisma.UserWhereInput {
  const usine = scopeUsine(session);
  return usine ? { usine } : {};
}

/** Libellé du périmètre courant, pour l'affichage. */
export function scopeLabel(session: SessionPayload): string {
  return scopeUsine(session) ?? "Toutes les usines";
}
