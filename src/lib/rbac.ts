import type { Role } from "@prisma/client";

/**
 * Permissions fines (RBAC), complétées par une **portée par usine**.
 *
 * Deux dimensions indépendantes :
 *  - la permission dit *ce que* l'utilisateur peut faire ;
 *  - l'usine de rattachement dit *sur quel périmètre* (voir `scopeUsine`).
 */
export type Permission =
  // Ordres de fabrication
  | "order:read"
  | "order:create"
  | "order:update"
  | "order:validateProduction"
  | "order:validateQuality"
  | "order:close"
  // Saisie production
  | "production:read"
  | "production:write"
  // Contrôle qualité
  | "quality:read"
  | "quality:write"
  // Non-conformités
  | "nc:read"
  | "nc:write"
  // Référentiel ERP (toujours lecture seule)
  | "erp:read"
  | "erp:sync"
  // Planning de production
  | "planning:read"
  | "planning:write"
  // Reporting & exports
  | "report:read"
  | "report:export"
  // Administration
  | "user:manage" //      gérer les comptes (dans son périmètre d'usine)
  | "user:manageAll" //   gérer les comptes de toutes les usines et tous les rôles
  | "audit:read"
  | "settings:manage";

const MATRIX: Record<Role, Permission[]> = {
  /** Informatique : administration technique complète, toutes usines. */
  SUPER_ADMIN: [
    "order:read", "order:create", "order:update",
    "order:validateProduction", "order:validateQuality", "order:close",
    "production:read", "production:write",
    "quality:read", "quality:write",
    "nc:read", "nc:write",
    "erp:read", "erp:sync",
    "planning:read", "planning:write",
    "report:read", "report:export",
    "user:manage", "user:manageAll", "audit:read", "settings:manage",
  ],
  /** Direction Générale : voit tout, pilote et exporte, ne saisit pas. */
  DIRECTION: [
    "order:read",
    "production:read",
    "quality:read",
    "nc:read",
    "erp:read",
    "planning:read",
    "report:read", "report:export",
    "audit:read",
  ],
  /**
   * Directeur d'usine : administre son site. Il gère les comptes de son
   * usine et suit toute son activité, sans pouvoir saisir à la place
   * des équipes ni voir les autres usines.
   */
  DIRECTEUR_USINE: [
    "order:read",
    "production:read",
    "quality:read",
    "nc:read",
    "erp:read",
    "planning:read", "planning:write",
    "report:read", "report:export",
    "user:manage", "audit:read",
  ],
  PRODUCTION: [
    "order:read", "order:create", "order:update", "order:validateProduction",
    "production:read", "production:write",
    "quality:read",
    "nc:read",
    "erp:read",
    "planning:read", "planning:write",
    "report:read", "report:export",
  ],
  QUALITY: [
    "order:read", "order:validateQuality",
    "production:read", //          lecture seule des données production
    "quality:read", "quality:write",
    "nc:read", "nc:write",
    "erp:read",
    "planning:read",
    "report:read", "report:export",
  ],
  PRODUCTION_MANAGER: [
    "order:read", "order:close",
    "production:read",
    "quality:read",
    "nc:read",
    "erp:read", "audit:read",
    "planning:read", "planning:write",
    "report:read", "report:export",
  ],
  VIEWER: [
    "order:read", "production:read", "quality:read", "nc:read", "erp:read",
    "planning:read",
  ],
};

export function can(role: Role, permission: Permission): boolean {
  return MATRIX[role]?.includes(permission) ?? false;
}

export function permissionsFor(role: Role): Permission[] {
  return MATRIX[role] ?? [];
}

export const ROLE_LABELS: Record<Role, string> = {
  SUPER_ADMIN: "Administrateur système",
  DIRECTION: "Direction Générale",
  DIRECTEUR_USINE: "Directeur d'usine",
  PRODUCTION: "Responsable Production",
  QUALITY: "Responsable Qualité",
  PRODUCTION_MANAGER: "Responsable Gestion Production",
  VIEWER: "Consultation",
};

/** Rôles dont le périmètre est nécessairement l'ensemble des usines. */
const ROLES_TOUTES_USINES: Role[] = ["SUPER_ADMIN", "DIRECTION"];

export function estRoleGlobal(role: Role) {
  return ROLES_TOUTES_USINES.includes(role);
}

/**
 * Usine sur laquelle porte la session, ou `null` pour « toutes les usines ».
 * C'est cette valeur qui filtre les données côté serveur.
 */
export function scopeUsine(session: { role: Role; usine?: string | null }): string | null {
  if (estRoleGlobal(session.role)) return null;
  return session.usine?.trim() || null;
}

/**
 * Rôles qu'un utilisateur a le droit d'attribuer.
 * Un directeur d'usine ne peut créer que des comptes opérationnels : il ne
 * peut ni se cloner, ni fabriquer un accès global.
 */
export function rolesAttribuables(role: Role): Role[] {
  if (can(role, "user:manageAll")) {
    return [
      "SUPER_ADMIN", "DIRECTION", "DIRECTEUR_USINE",
      "PRODUCTION", "QUALITY", "PRODUCTION_MANAGER", "VIEWER",
    ];
  }
  if (can(role, "user:manage")) {
    return ["PRODUCTION", "QUALITY", "PRODUCTION_MANAGER", "VIEWER"];
  }
  return [];
}
