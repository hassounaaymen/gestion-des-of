"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarClock, Loader2, Save, AlertTriangle } from "lucide-react";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

export interface PlanTarget {
  id: string;
  number: string;
  articleDesignation: string;
  dateDebut: string | null;
  dateFinPrev: string | null;
  atelier: string | null;
  equipe: string | null;
  chefEquipe: string | null;
  priorite: string;
  /** Ligne de production issue de l'ERP, proposée par défaut comme atelier */
  suggestedAtelier?: string | null;
}

const PRIORITES = [
  { value: "BASSE", label: "Basse", cls: "border-muted-foreground text-muted-foreground" },
  { value: "NORMALE", label: "Normale", cls: "border-primary text-primary" },
  { value: "HAUTE", label: "Haute", cls: "border-warning text-warning" },
  { value: "URGENTE", label: "Urgente", cls: "border-destructive text-destructive" },
];

/** Convertit une date ISO en valeur d'input datetime-local (heure locale). */
function toLocalInput(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function PlanOrderDialog({
  target,
  ateliers,
  open,
  onOpenChange,
}: {
  target: PlanTarget | null;
  ateliers: string[];
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Le formulaire se réinitialise à chaque changement d'OF ciblé
  const initial = useMemo(
    () => ({
      dateDebut: toLocalInput(target?.dateDebut ?? null),
      dateFinPrev: toLocalInput(target?.dateFinPrev ?? null),
      atelier: target?.atelier ?? target?.suggestedAtelier ?? "",
      equipe: target?.equipe ?? "",
      chefEquipe: target?.chefEquipe ?? "",
      priorite: target?.priorite ?? "NORMALE",
    }),
    [target],
  );
  const [form, setForm] = useState(initial);
  const [dirtyKey, setDirtyKey] = useState(target?.id);
  if (dirtyKey !== target?.id) {
    setDirtyKey(target?.id);
    setForm(initial);
    setError(null);
  }

  function set<K extends keyof typeof form>(key: K, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  const incoherent =
    Boolean(form.dateDebut && form.dateFinPrev) &&
    new Date(form.dateFinPrev).getTime() < new Date(form.dateDebut).getTime();
  const incomplet = Boolean(form.dateDebut) !== Boolean(form.dateFinPrev);

  /** Durée planifiée, en jours ouvrés inclus. */
  const duree = useMemo(() => {
    if (!form.dateDebut || !form.dateFinPrev || incoherent) return null;
    const d1 = new Date(form.dateDebut);
    const d2 = new Date(form.dateFinPrev);
    d1.setHours(0, 0, 0, 0);
    d2.setHours(0, 0, 0, 0);
    return Math.round((d2.getTime() - d1.getTime()) / 86_400_000) + 1;
  }, [form.dateDebut, form.dateFinPrev, incoherent]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!target) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/orders/${target.id}/planning`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          dateDebut: form.dateDebut ? new Date(form.dateDebut).toISOString() : "",
          dateFinPrev: form.dateFinPrev ? new Date(form.dateFinPrev).toISOString() : "",
          atelier: form.atelier,
          equipe: form.equipe,
          chefEquipe: form.chefEquipe,
          priorite: form.priorite,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.details?.[0]?.message ?? data.error ?? "Échec");
      onOpenChange(false);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CalendarClock className="h-5 w-5 text-primary" />
            Planifier {target?.number}
          </DialogTitle>
          <DialogDescription>{target?.articleDesignation}</DialogDescription>
        </DialogHeader>

        <form onSubmit={submit} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="pl-debut">Date de début *</Label>
              <Input
                id="pl-debut"
                type="datetime-local"
                value={form.dateDebut}
                onChange={(e) => set("dateDebut", e.target.value)}
                className={cn(incomplet && !form.dateDebut && "border-destructive")}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="pl-fin">Date de fin prévue *</Label>
              <Input
                id="pl-fin"
                type="datetime-local"
                value={form.dateFinPrev}
                onChange={(e) => set("dateFinPrev", e.target.value)}
                className={cn((incoherent || (incomplet && !form.dateFinPrev)) && "border-destructive")}
              />
            </div>
          </div>

          {incoherent && (
            <p className="flex items-center gap-2 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              La fin prévue précède le début.
            </p>
          )}
          {duree !== null && (
            <p className="text-xs text-muted-foreground">
              Durée planifiée : <span className="font-medium text-foreground">{duree} jour(s)</span>
            </p>
          )}

          <div className="space-y-2">
            <Label htmlFor="pl-atelier">Atelier / Ligne</Label>
            <input
              id="pl-atelier"
              list="ateliers-list"
              value={form.atelier}
              onChange={(e) => set("atelier", e.target.value)}
              placeholder="Ex. VIFESA"
              className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
            <datalist id="ateliers-list">
              {ateliers.map((a) => (
                <option key={a} value={a} />
              ))}
            </datalist>
            {target?.suggestedAtelier && !target.atelier && (
              <p className="text-xs text-muted-foreground">
                Ligne de production de l'article : {target.suggestedAtelier}
              </p>
            )}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="pl-equipe">Équipe</Label>
              <Input id="pl-equipe" value={form.equipe} onChange={(e) => set("equipe", e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="pl-chef">Chef d'équipe</Label>
              <Input id="pl-chef" value={form.chefEquipe} onChange={(e) => set("chefEquipe", e.target.value)} />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Priorité</Label>
            <div className="flex flex-wrap gap-2">
              {PRIORITES.map((p) => (
                <button
                  key={p.value}
                  type="button"
                  onClick={() => set("priorite", p.value)}
                  className={cn(
                    "rounded-md border-2 px-3 py-1.5 text-sm font-medium transition-colors",
                    form.priorite === p.value ? `${p.cls} bg-accent/40` : "border-border text-muted-foreground",
                  )}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          {error && (
            <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Annuler
            </Button>
            <Button type="submit" disabled={saving || incoherent || incomplet}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Enregistrer la planification
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
