"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { UserPlus, Loader2, Pencil, KeyRound, Factory, ShieldCheck } from "lucide-react";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ROLE_LABELS } from "@/lib/rbac";
import { formatDateTime, cn } from "@/lib/utils";
import type { Role } from "@prisma/client";

interface UserRow {
  id: string;
  username: string;
  email: string;
  fullName: string;
  role: Role;
  usine: string | null;
  isActive: boolean;
  lastLogin: string | null;
}

interface Payload {
  users: UserRow[];
  roles: Role[];
  unites: string[];
  scope: string | null;
}

/** Rôles à portée globale : ils ne se rattachent à aucune usine. */
const ROLES_GLOBAUX: Role[] = ["SUPER_ADMIN", "DIRECTION"];

const ROLE_TONE: Partial<Record<Role, string>> = {
  SUPER_ADMIN: "bg-slate-600",
  DIRECTION: "bg-violet-600",
  DIRECTEUR_USINE: "bg-primary",
  PRODUCTION: "bg-blue-500",
  QUALITY: "bg-success",
  PRODUCTION_MANAGER: "bg-warning",
  VIEWER: "bg-muted-foreground",
};

export function UsersManager({ currentUserId }: { currentUserId: string }) {
  const qc = useQueryClient();
  const [editing, setEditing] = useState<UserRow | null>(null);
  const [creating, setCreating] = useState(false);
  const [resetting, setResetting] = useState<UserRow | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["users"],
    queryFn: async () => {
      const res = await fetch("/api/users");
      if (!res.ok) throw new Error("Chargement impossible");
      return res.json() as Promise<Payload>;
    },
  });

  function refresh() {
    qc.invalidateQueries({ queryKey: ["users"] });
  }

  if (isLoading || !data) {
    return <p className="py-10 text-center text-sm text-muted-foreground">Chargement…</p>;
  }

  // Regroupement par usine : c'est la lecture naturelle pour la direction
  const groupes = new Map<string, UserRow[]>();
  for (const u of data.users) {
    const k = u.usine ?? "Toutes les usines";
    groupes.set(k, [...(groupes.get(k) ?? []), u]);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          {data.users.length} compte(s)
          {data.scope && (
            <>
              {" · périmètre "}
              <span className="font-medium text-foreground">{data.scope}</span>
            </>
          )}
        </p>
        <Button onClick={() => setCreating(true)}>
          <UserPlus className="h-4 w-4" /> Nouveau compte
        </Button>
      </div>

      {Array.from(groupes.entries()).map(([usine, users]) => (
        <div key={usine} className="space-y-2">
          <h3 className="flex items-center gap-2 text-sm font-semibold">
            {usine === "Toutes les usines" ? (
              <ShieldCheck className="h-4 w-4 text-muted-foreground" />
            ) : (
              <Factory className="h-4 w-4 text-primary" />
            )}
            {usine}
            <span className="font-normal text-muted-foreground">({users.length})</span>
          </h3>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nom complet</TableHead>
                <TableHead>Identifiant</TableHead>
                <TableHead>E-mail</TableHead>
                <TableHead>Rôle</TableHead>
                <TableHead>État</TableHead>
                <TableHead>Dernière connexion</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((u) => (
                <TableRow key={u.id}>
                  <TableCell className="font-medium">
                    {u.fullName}
                    {u.id === currentUserId && (
                      <span className="ml-2 text-xs text-muted-foreground">(vous)</span>
                    )}
                  </TableCell>
                  <TableCell className="font-mono text-sm">{u.username}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{u.email}</TableCell>
                  <TableCell>
                    <span className="inline-flex items-center gap-1.5 text-sm">
                      <span className={cn("h-2 w-2 rounded-full", ROLE_TONE[u.role])} />
                      {ROLE_LABELS[u.role]}
                    </span>
                  </TableCell>
                  <TableCell>
                    {u.isActive ? (
                      <Badge variant="success">Actif</Badge>
                    ) : (
                      <Badge variant="destructive">Désactivé</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {u.lastLogin ? formatDateTime(u.lastLogin) : "jamais"}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="icon" title="Modifier" onClick={() => setEditing(u)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        title="Réinitialiser le mot de passe"
                        onClick={() => setResetting(u)}
                      >
                        <KeyRound className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ))}

      <UserDialog
        open={creating}
        onOpenChange={setCreating}
        roles={data.roles}
        unites={data.unites}
        scope={data.scope}
        onSaved={refresh}
      />
      <UserDialog
        open={Boolean(editing)}
        onOpenChange={(v) => !v && setEditing(null)}
        user={editing ?? undefined}
        roles={data.roles}
        unites={data.unites}
        scope={data.scope}
        isSelf={editing?.id === currentUserId}
        onSaved={refresh}
      />
      <PasswordDialog
        user={resetting}
        onOpenChange={(v) => !v && setResetting(null)}
        onSaved={refresh}
      />
    </div>
  );
}

/** Création et modification partagent le même formulaire. */
function UserDialog({
  open, onOpenChange, user, roles, unites, scope, isSelf, onSaved,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  user?: UserRow;
  roles: Role[];
  unites: string[];
  scope: string | null;
  isSelf?: boolean;
  onSaved: () => void;
}) {
  const modification = Boolean(user);
  const [form, setForm] = useState({
    username: "", email: "", fullName: "",
    role: (roles[0] ?? "VIEWER") as Role,
    usine: scope ?? "",
    password: "",
    isActive: true,
  });
  const [key, setKey] = useState<string | undefined>(user?.id);
  if (key !== user?.id) {
    setKey(user?.id);
    setForm({
      username: user?.username ?? "",
      email: user?.email ?? "",
      fullName: user?.fullName ?? "",
      role: user?.role ?? ((roles[0] ?? "VIEWER") as Role),
      usine: user?.usine ?? scope ?? "",
      password: "",
      isActive: user?.isActive ?? true,
    });
  }

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const roleGlobal = ROLES_GLOBAUX.includes(form.role);

  function set<K extends keyof typeof form>(k: K, v: (typeof form)[K]) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const body = modification
        ? {
            email: form.email,
            fullName: form.fullName,
            role: form.role,
            usine: roleGlobal ? null : form.usine,
            isActive: form.isActive,
          }
        : {
            username: form.username,
            email: form.email,
            fullName: form.fullName,
            role: form.role,
            usine: roleGlobal ? null : form.usine,
            password: form.password,
          };
      const res = await fetch(modification ? `/api/users/${user!.id}` : "/api/users", {
        method: modification ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.details?.[0]?.message ?? data.error ?? "Échec");
      onOpenChange(false);
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{modification ? "Modifier le compte" : "Nouveau compte"}</DialogTitle>
          <DialogDescription>
            {modification
              ? user?.username
              : "L'utilisateur pourra se connecter avec son identifiant ou son e-mail."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={submit} className="space-y-4">
          {!modification && (
            <div className="space-y-2">
              <Label htmlFor="u-username">Identifiant *</Label>
              <Input
                id="u-username"
                value={form.username}
                onChange={(e) => set("username", e.target.value)}
                placeholder="p.martin"
                required
              />
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="u-fullname">Nom complet *</Label>
              <Input id="u-fullname" value={form.fullName} onChange={(e) => set("fullName", e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="u-email">E-mail *</Label>
              <Input id="u-email" type="email" value={form.email} onChange={(e) => set("email", e.target.value)} required />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="u-role">Rôle *</Label>
              <select
                id="u-role"
                value={form.role}
                disabled={isSelf}
                onChange={(e) => set("role", e.target.value as Role)}
                className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm shadow-sm disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {roles.map((r) => (
                  <option key={r} value={r}>{ROLE_LABELS[r]}</option>
                ))}
              </select>
              {isSelf && (
                <p className="text-xs text-muted-foreground">
                  Vous ne pouvez pas modifier votre propre rôle.
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="u-usine">Usine {roleGlobal ? "" : "*"}</Label>
              <select
                id="u-usine"
                value={roleGlobal ? "" : form.usine}
                disabled={roleGlobal || Boolean(scope)}
                onChange={(e) => set("usine", e.target.value)}
                className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm shadow-sm disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <option value="">{roleGlobal ? "Toutes les usines" : "— Sélectionner —"}</option>
                {unites.map((u) => (
                  <option key={u} value={u}>{u}</option>
                ))}
              </select>
              {roleGlobal && (
                <p className="text-xs text-muted-foreground">
                  Ce rôle donne accès à toutes les usines.
                </p>
              )}
            </div>
          </div>

          {!modification && (
            <div className="space-y-2">
              <Label htmlFor="u-password">Mot de passe initial *</Label>
              <Input
                id="u-password"
                type="password"
                value={form.password}
                onChange={(e) => set("password", e.target.value)}
                required
              />
              <p className="text-xs text-muted-foreground">
                8 caractères minimum, avec au moins une lettre et un chiffre.
              </p>
            </div>
          )}

          {modification && (
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={form.isActive}
                disabled={isSelf}
                onChange={(e) => set("isActive", e.target.checked)}
                className="h-4 w-4 rounded border-input"
              />
              Compte actif
              {isSelf && (
                <span className="text-xs text-muted-foreground">
                  (vous ne pouvez pas désactiver votre propre compte)
                </span>
              )}
            </label>
          )}

          {error && (
            <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Annuler
            </Button>
            <Button type="submit" disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              {modification ? "Enregistrer" : "Créer le compte"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function PasswordDialog({
  user, onOpenChange, onSaved,
}: {
  user: UserRow | null;
  onOpenChange: (v: boolean) => void;
  onSaved: () => void;
}) {
  const [password, setPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/users/${user.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.details?.[0]?.message ?? data.error ?? "Échec");
      setPassword("");
      onOpenChange(false);
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={Boolean(user)} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <KeyRound className="h-5 w-5 text-primary" />
            Réinitialiser le mot de passe
          </DialogTitle>
          <DialogDescription>
            {user?.fullName} — {user?.username}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="pw-new">Nouveau mot de passe</Label>
            <Input
              id="pw-new"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
            <p className="text-xs text-muted-foreground">
              8 caractères minimum, avec au moins une lettre et un chiffre.
              Communiquez-le à l'utilisateur par un canal sûr.
            </p>
          </div>
          {error && (
            <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Annuler
            </Button>
            <Button type="submit" disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              Réinitialiser
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
