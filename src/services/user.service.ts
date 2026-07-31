import { prisma } from "@/lib/prisma";
import type { Role } from "@prisma/client";
import { ApiError } from "@/lib/api";
import { hashPassword } from "@/lib/password";
import { writeAudit } from "@/lib/audit";
import { can, estRoleGlobal, rolesAttribuables, scopeUsine } from "@/lib/rbac";
import type { SessionPayload } from "@/lib/session";
import type { UserCreateInput, UserUpdateInput } from "@/lib/validations";

/**
 * Gestion des comptes, cloisonnée par usine.
 *
 * Deux niveaux d'administration :
 *  - l'informatique (`user:manageAll`) gère tous les comptes, toutes usines ;
 *  - le directeur d'usine (`user:manage`) ne gère que les comptes de son site,
 *    et ne peut attribuer que des rôles opérationnels.
 */

const SAFE_FIELDS = {
  id: true, username: true, email: true, fullName: true,
  role: true, usine: true, isActive: true, lastLogin: true, createdAt: true,
} as const;

/** Vérifie que l'appelant a le droit d'agir sur ce rôle et cette usine. */
function assertPeutAttribuer(session: SessionPayload, role: Role, usine: string | null) {
  const autorises = rolesAttribuables(session.role);
  if (!autorises.includes(role)) {
    throw new ApiError(403, `Vous ne pouvez pas attribuer le rôle « ${role} »`);
  }
  const portee = scopeUsine(session);
  if (portee && usine !== portee) {
    throw new ApiError(403, `Vous ne pouvez créer des comptes que pour ${portee}`);
  }
  // Un rôle global ne peut pas être rattaché à une usine, et inversement
  if (estRoleGlobal(role) && usine) {
    throw new ApiError(422, "Un rôle à portée globale ne se rattache pas à une usine");
  }
  if (!estRoleGlobal(role) && !usine) {
    throw new ApiError(422, "Ce rôle doit être rattaché à une usine");
  }
}

/** Charge un compte en vérifiant qu'il est dans le périmètre de l'appelant. */
async function chargerDansPerimetre(session: SessionPayload, id: string) {
  const portee = scopeUsine(session);
  const user = await prisma.user.findFirst({
    where: { id, ...(portee ? { usine: portee } : {}) },
  });
  if (!user) throw new ApiError(404, "Compte introuvable");
  return user;
}

export const userService = {
  /** Liste les comptes visibles par l'appelant. */
  list(session: SessionPayload) {
    const portee = scopeUsine(session);
    return prisma.user.findMany({
      where: portee ? { usine: portee } : {},
      select: SAFE_FIELDS,
      orderBy: [{ usine: "asc" }, { role: "asc" }, { fullName: "asc" }],
    });
  },

  async create(session: SessionPayload, input: UserCreateInput) {
    if (!can(session.role, "user:manage")) throw new ApiError(403, "Accès refusé");

    // Le directeur d'usine ne peut créer que pour son propre site.
    // Une usine explicitement différente est refusée plutôt que corrigée en
    // silence : l'administrateur doit savoir que sa demande n'a pas été suivie.
    const portee = scopeUsine(session);
    const demandee = input.usine?.trim() || null;
    if (portee && demandee && demandee !== portee) {
      throw new ApiError(403, `Vous ne pouvez créer des comptes que pour ${portee}`);
    }
    const usine = estRoleGlobal(input.role) ? null : (portee ?? demandee);
    assertPeutAttribuer(session, input.role, usine);

    const existant = await prisma.user.findFirst({
      where: { OR: [{ username: input.username }, { email: input.email }] },
      select: { username: true, email: true },
    });
    if (existant) {
      throw new ApiError(
        409,
        existant.username === input.username
          ? "Cet identifiant est déjà utilisé"
          : "Cette adresse e-mail est déjà utilisée",
      );
    }

    const user = await prisma.user.create({
      data: {
        username: input.username.trim(),
        email: input.email.trim().toLowerCase(),
        fullName: input.fullName.trim(),
        role: input.role,
        usine,
        password: await hashPassword(input.password),
      },
      select: SAFE_FIELDS,
    });

    await writeAudit({
      userId: session.sub,
      action: "USER_CREATE",
      entity: "User",
      entityId: user.id,
      after: { ...user, password: undefined },
    });
    return user;
  },

  async update(session: SessionPayload, id: string, input: UserUpdateInput) {
    if (!can(session.role, "user:manage")) throw new ApiError(403, "Accès refusé");
    const avant = await chargerDansPerimetre(session, id);

    // Garde-fou : on ne se retire pas soi-même l'accès
    if (avant.id === session.sub) {
      if (input.isActive === false) {
        throw new ApiError(422, "Vous ne pouvez pas désactiver votre propre compte");
      }
      if (input.role && input.role !== avant.role) {
        throw new ApiError(422, "Vous ne pouvez pas modifier votre propre rôle");
      }
    }

    const role = input.role ?? avant.role;
    const portee = scopeUsine(session);
    const demandee = input.usine !== undefined ? input.usine?.trim() || null : avant.usine;
    if (portee && demandee && demandee !== portee) {
      throw new ApiError(403, `Vous ne pouvez rattacher un compte qu'à ${portee}`);
    }
    const usine = estRoleGlobal(role) ? null : (portee ?? demandee);
    assertPeutAttribuer(session, role, usine);

    // Le rôle d'origine doit lui aussi être dans le périmètre de l'appelant
    if (!rolesAttribuables(session.role).includes(avant.role)) {
      throw new ApiError(403, "Ce compte dépasse votre périmètre d'administration");
    }

    if (input.email && input.email !== avant.email) {
      const conflit = await prisma.user.findFirst({
        where: { email: input.email, id: { not: id } },
        select: { id: true },
      });
      if (conflit) throw new ApiError(409, "Cette adresse e-mail est déjà utilisée");
    }

    const user = await prisma.user.update({
      where: { id },
      data: {
        ...(input.email ? { email: input.email.trim().toLowerCase() } : {}),
        ...(input.fullName ? { fullName: input.fullName.trim() } : {}),
        ...(input.role ? { role: input.role } : {}),
        usine,
        ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
        ...(input.password ? { password: await hashPassword(input.password) } : {}),
      },
      select: SAFE_FIELDS,
    });

    await writeAudit({
      userId: session.sub,
      action: input.password ? "USER_RESET_PASSWORD" : "USER_UPDATE",
      entity: "User",
      entityId: id,
      before: { ...avant, password: undefined },
      after: user,
    });
    return user;
  },
};
