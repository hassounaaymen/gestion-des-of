"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { Search, Loader2, Check, Factory, Plus, AlertTriangle } from "lucide-react";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface Article {
  id: string;
  code: string;
  designation: string;
  family: string | null;
  unit: string | null;
  productionLine: string | null;
}
interface Store {
  id: string;
  code: string;
  designation: string;
}

const PRIORITES = [
  { value: "BASSE", label: "Basse", cls: "border-muted-foreground text-muted-foreground" },
  { value: "NORMALE", label: "Normale", cls: "border-primary text-primary" },
  { value: "HAUTE", label: "Haute", cls: "border-warning text-warning" },
  { value: "URGENTE", label: "Urgente", cls: "border-destructive text-destructive" },
];

/** `yyyy-MM-ddTHH:mm` en heure locale, format attendu par datetime-local. */
function localInput(d: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error("Erreur réseau");
  return res.json();
}

/**
 * Création d'un OF directement depuis le planning : l'atelier et la date
 * du créneau cliqué sont pré-remplis, l'ordre naît donc déjà planifié.
 */
export function CreateOrderDialog({
  open,
  onOpenChange,
  atelier,
  day,
  ateliers,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  /** Atelier du créneau cliqué */
  atelier?: string | null;
  /** Jour du créneau cliqué (ISO) */
  day?: string | null;
  ateliers: string[];
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [article, setArticle] = useState<Article | null>(null);
  const [storeId, setStoreId] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const defaults = useMemo(() => {
    const start = day ? new Date(day) : new Date();
    start.setHours(7, 0, 0, 0);
    const end = new Date(start);
    end.setHours(16, 0, 0, 0);
    return {
      dateDebut: localInput(start),
      dateFinPrev: localInput(end),
      atelier: atelier && atelier !== "Non affecté" ? atelier : "",
      equipe: "",
      chefEquipe: "",
      qtePrevue: "",
      priorite: "NORMALE",
    };
  }, [atelier, day]);

  const [form, setForm] = useState(defaults);
  // Réinitialise le formulaire à chaque nouveau créneau ciblé
  const [slotKey, setSlotKey] = useState(`${atelier}|${day}`);
  if (slotKey !== `${atelier}|${day}`) {
    setSlotKey(`${atelier}|${day}`);
    setForm(defaults);
    setArticle(null);
    setStoreId("");
    setQuery("");
    setError(null);
  }

  const { data: articleData, isFetching } = useQuery({
    queryKey: ["articles-create", query],
    queryFn: () =>
      fetchJson<{ items: Article[]; total: number }>(
        `/api/articles?manufactured=1&take=25&q=${encodeURIComponent(query)}`,
      ),
    enabled: open && !article,
  });
  const { data: stores = [] } = useQuery({
    queryKey: ["stores", "pf"],
    queryFn: () => fetchJson<Store[]>("/api/stores?type=PRODUIT_FINI"),
    enabled: open,
  });

  function set<K extends keyof typeof form>(key: K, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  /** À la sélection, l'atelier vide se remplit avec la ligne ERP de l'article. */
  function selectArticle(a: Article) {
    setArticle(a);
    if (!form.atelier && a.productionLine) set("atelier", a.productionLine);
  }

  const incoherent =
    Boolean(form.dateDebut && form.dateFinPrev) &&
    new Date(form.dateFinPrev).getTime() < new Date(form.dateDebut).getTime();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!article) return setError("Sélectionnez un article à fabriquer");
    if (!storeId) return setError("Sélectionnez un magasin de destination");
    setSubmitting(true);
    try {
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          articleId: article.id,
          storeId,
          description: article.designation,
          atelier: form.atelier,
          equipe: form.equipe,
          chefEquipe: form.chefEquipe,
          dateDebut: form.dateDebut ? new Date(form.dateDebut).toISOString() : "",
          dateFinPrev: form.dateFinPrev ? new Date(form.dateFinPrev).toISOString() : "",
          qtePrevue: form.qtePrevue === "" ? 0 : Number(form.qtePrevue),
          priorite: form.priorite,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.details?.[0]?.message ?? data.error ?? "Échec de création");
      onOpenChange(false);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur");
    } finally {
      setSubmitting(false);
    }
  }

  const articles = articleData?.items ?? [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Plus className="h-5 w-5 text-primary" />
            Nouvel ordre de fabrication
          </DialogTitle>
          <DialogDescription>
            {atelier && atelier !== "Non affecté"
              ? `Créneau ${atelier}${day ? ` — ${new Date(day).toLocaleDateString("fr-FR")}` : ""}`
              : "L'ordre sera planifié dès sa création."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={submit} className="space-y-4">
          {/* Article */}
          <div className="space-y-2">
            <Label>Article à fabriquer *</Label>
            {article ? (
              <div className="flex items-center justify-between gap-2 rounded-md border bg-accent/40 px-3 py-2">
                <div className="min-w-0">
                  <p className="truncate font-medium">{article.designation}</p>
                  <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                    <span className="font-mono">{article.code}</span>
                    {article.family && (
                      <Badge variant="secondary" className="h-4 px-1.5 text-[10px]">{article.family}</Badge>
                    )}
                    {article.productionLine && (
                      <Badge variant="default" className="h-4 gap-0.5 px-1.5 text-[10px]">
                        <Factory className="h-2.5 w-2.5" />
                        {article.productionLine}
                      </Badge>
                    )}
                  </div>
                </div>
                <Button type="button" variant="ghost" size="sm" onClick={() => setArticle(null)}>
                  Changer
                </Button>
              </div>
            ) : (
              <div className="rounded-md border">
                <div className="flex items-center gap-2 border-b px-3">
                  <Search className="h-4 w-4 text-muted-foreground" />
                  <input
                    className="h-9 flex-1 bg-transparent text-sm outline-none"
                    placeholder="Code, désignation ou famille…"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                  />
                  {isFetching && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
                </div>
                <ul className="max-h-48 overflow-y-auto">
                  {articles.length === 0 && (
                    <li className="px-3 py-5 text-center text-sm text-muted-foreground">
                      Aucun article fabricable trouvé
                    </li>
                  )}
                  {articles.map((a) => (
                    <li key={a.id}>
                      <button
                        type="button"
                        onClick={() => selectArticle(a)}
                        className="flex w-full items-start justify-between gap-3 px-3 py-2 text-left text-sm hover:bg-accent"
                      >
                        <span className="min-w-0">
                          <span className="block truncate font-medium">{a.designation}</span>
                          <span className="font-mono text-xs text-muted-foreground">{a.code}</span>
                        </span>
                        {a.productionLine && (
                          <Badge variant="secondary" className="shrink-0 text-[10px]">
                            {a.productionLine}
                          </Badge>
                        )}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          {/* Magasin + quantité */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="co-store">Magasin de destination *</Label>
              <select
                id="co-store"
                value={storeId}
                onChange={(e) => setStoreId(e.target.value)}
                className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <option value="">— Sélectionner —</option>
                {stores.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.designation} ({s.code})
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="co-qte">
                Quantité prévue{article?.unit ? ` (${article.unit})` : ""}
              </Label>
              <Input
                id="co-qte"
                type="number"
                min="0"
                step="any"
                value={form.qtePrevue}
                onChange={(e) => set("qtePrevue", e.target.value)}
              />
            </div>
          </div>

          {/* Planification */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="co-debut">Date de début</Label>
              <Input
                id="co-debut"
                type="datetime-local"
                value={form.dateDebut}
                onChange={(e) => set("dateDebut", e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="co-fin">Date de fin prévue</Label>
              <Input
                id="co-fin"
                type="datetime-local"
                value={form.dateFinPrev}
                onChange={(e) => set("dateFinPrev", e.target.value)}
                className={cn(incoherent && "border-destructive")}
              />
            </div>
          </div>

          {incoherent && (
            <p className="flex items-center gap-2 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              La fin prévue précède le début.
            </p>
          )}

          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="co-atelier">Atelier / Ligne</Label>
              <input
                id="co-atelier"
                list="ateliers-create"
                value={form.atelier}
                onChange={(e) => set("atelier", e.target.value)}
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
              <datalist id="ateliers-create">
                {ateliers.map((a) => (
                  <option key={a} value={a} />
                ))}
              </datalist>
            </div>
            <div className="space-y-2">
              <Label htmlFor="co-equipe">Équipe</Label>
              <Input id="co-equipe" value={form.equipe} onChange={(e) => set("equipe", e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="co-chef">Chef d'équipe</Label>
              <Input id="co-chef" value={form.chefEquipe} onChange={(e) => set("chefEquipe", e.target.value)} />
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
            <Button type="submit" disabled={submitting || incoherent}>
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              Créer l'ordre
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
