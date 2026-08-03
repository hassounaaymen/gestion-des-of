import { prisma } from "@/lib/prisma";
import type { Role } from "@prisma/client";
import { ApiError } from "@/lib/api";
import { hashPassword } from "@/lib/password";
import { writeAudit } from "@/lib/audit";
import { can, estRoleGlobal, rolesAttribuables, scopeUsines } from "@/lib/rbac";
import {
  parseUsines,
  serializeUsines,
  usinesIncluses,
  usinesLabel,
} from "@/lib/usines";
import type { SessionPayload } from "@/lib/session";
import type { UserCreateInput, UserUpdateInput } from "@/lib/validations";

/**
 * Gestion des comptes, cloisonnée par usine.
 *
 * Deux niveaux d'administration :
 *  - l'informatique (`user:manageAll`) gère tous les comptes, toutes usines ;
 *  - le directeur d'usine (`user:manage`) ne gère que les comptes de son
 *    périmètre, et ne peut attribuer que des rôles opérationnels.
 *
 * Un compte peut être rattaché à plusieurs usines, ou à toutes (`null`).
 */

const SAFE_FIELDS = {
  id: true, username: true, email: true, fullName: true,
  role: true, usines: true, isActive: true, lastLogin: true, createdAt: true,
} as const;

/** Vérifie que l'appelant a le droit d'agir sur ce rôle et ces usines. */
function assertPeutAttribuer(
  session: SessionPayload,
  role: Role,
  usines: string[] | null,
) {
  const autorises = rolesAttribuables(session.role);
  if (!autorises.includes(role)) {
    throw new ApiError(403, `Vous ne pouvez pas attribuer le rôle « ${role} »`);
  }
  // Un administrateur restreint ne peut pas accorder plus large que son propre
  // périmètre — sans quoi le cloisonnement se contournerait par la création
  // d'un compte.
  const portee = scopeUsines(session);
  if (!usinesIncluses(usines, portee)) {
    throw new ApiError(
      403,
      `Vous ne pouvez créer des comptes que pour ${usinesLabel(portee)}`,
    );
  }
  // Un rôle global voit tout par construction : le rattacher à une usine
  // donnerait une fausse impression de restriction.
  if (estRoleGlobal(role) && usines !== null) {
    throw new ApiError(
      422,
      "Un rôle à portée globale ne se rattache pas à une usine",
    );
  }
}

/** Charge un compte en vérifiant qu'il est dans le périmètre de l'appelant. */
async function chargerDansPerimetre(session: SessionPayload, id: string) {
  const user = await prisma.user.findUnique({ where: { id } });
  // 404 plutôt que 403 : l'existence d'un compte d'une autre usine ne doit
  // pas être déductible.
  if (!user) throw new ApiError(404, "Compte introuvable");
  if (!usinesIncluses(parseUsines(user.usines), scopeUsines(session))) {
    throw new ApiError(404, "Compte introuvable");
  }
  return user;
}

export const userService = {
  /**
   * Liste les comptes administrables par l'appelant.
   *
   * Le recoupement des usines se fait en mémoire : le rattachement est stocké
   * en liste, que SQLite ne sait pas interroger, et le volume de comptes rend
   * le filtrage côté base inutile. Un compte n'est listé que s'il est
   * entièrement dans le périmètre, pour que tout ce qui s'affiche soit
   * réellement modifiable.
   */
  async list(session: SessionPayload) {
    const portee = scopeUsines(session);
    const users = await prisma.user.findMany({
      select: SAFE_FIELDS,
      orderBy: [{ usines: "asc" }, { role: "asc" }, { fullName: "asc" }],
    });
    return users
      .filter((u) => usinesIncluses(parseUsines(u.usines), portee))
      .map((u) => ({ ...u, usines: parseUsines(u.usines) }));
  },

  async create(session: SessionPayload, input: UserCreateInput) {
    if (!can(session.role, "user:manage")) throw new ApiError(403, "Accès refusé");

    // Un rôle global voit tout : son rattachement est forcé à « toutes ».
    // Sinon on prend la demande telle quelle — une usine hors périmètre est
    // refusée par `assertPeutAttribuer` plutôt que corrigée en silence :
    // l'administrateur doit savoir que sa demande n'a pas été suivie.
    const usines = estRoleGlobal(input.role) ? null : input.usines;
    assertPeutAttribuer(session, input.role, usines);

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
        usines: serializeUsines(usines),
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
    return { ...user, usines: parseUsines(user.usines) };
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
    // `usines` absent = rattachement inchangé ; `null` = toutes les usines.
    const demandees =
      input.usines !== undefined ? input.usines : parseUsines(avant.usines);
    const usines = estRoleGlobal(role) ? null : demandees;
    assertPeutAttribuer(session, role, usines);

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
        usines: serializeUsines(usines),
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
    return { ...user, usines: parseUsines(user.usines) };
  },
};
