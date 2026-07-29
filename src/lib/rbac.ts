import type { Role } from "@prisma/client";

/**
 * Matrice de permissions fines (RBAC).
 * Chaque rôle ne peut agir que sur les informations qui lui appartiennent.
 */
export type Permission =
  // Ordres de fabrication
  | "order:read"
  | "order:create"
  | "order:update"
  | "order:validateProduction" // verrouille la saisie production
  | "order:validateQuality" //    valide le contrôle qualité
  | "order:close" //              clôture après validation qualité
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
  | "user:manage"
  | "audit:read"
  | "settings:manage";

const MATRIX: Record<Role, Permission[]> = {
  ADMIN: [
    "order:read", "order:create", "order:update",
    "order:validateProduction", "order:validateQuality", "order:close",
    "production:read", "production:write",
    "quality:read", "quality:write",
    "nc:read", "nc:write",
    "erp:read", "erp:sync",
    "planning:read", "planning:write",
    "report:read", "report:export",
    "user:manage", "audit:read", "settings:manage",
  ],
  /**
   * Direction Générale : voit tout, pilote et exporte, mais ne saisit pas
   * à la place des équipes. Elle arbitre au-dessus de Production et Qualité.
   */
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
  ADMIN: "Administrateur",
  DIRECTION: "Direction Générale",
  PRODUCTION: "Responsable Production",
  QUALITY: "Responsable Qualité",
  PRODUCTION_MANAGER: "Responsable Gestion Production",
  VIEWER: "Consultation",
};
