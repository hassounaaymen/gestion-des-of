"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { Loader2, Search, Check, Factory, Package } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface Article {
  id: string;
  code: string;
  designation: string;
  family?: string | null;
  unit?: string | null;
  productionLine?: string | null;
  itemType?: string;
}
interface Store {
  id: string;
  code: string;
  designation: string;
  type: string;
}

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error("Erreur réseau");
  return res.json();
}

export function OrderCreateForm() {
  const router = useRouter();
  const [articleQuery, setArticleQuery] = useState("");
  const [article, setArticle] = useState<Article | null>(null);
  const [storeId, setStoreId] = useState("");
  const [form, setForm] = useState({
    description: "",
    atelier: "",
    equipe: "",
    chefEquipe: "",
    dateDebut: "",
    dateFinPrev: "",
    observation: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Seuls les produits finis / semi-finis sont fabricables
  const { data: articleData, isFetching } = useQuery({
    queryKey: ["articles", articleQuery],
    queryFn: () =>
      fetchJson<{ items: Article[]; total: number }>(
        `/api/articles?manufactured=1&take=40&q=${encodeURIComponent(articleQuery)}`,
      ),
    enabled: !article,
  });
  const articles = articleData?.items ?? [];

  // Un OF alimente un magasin de produits finis
  const { data: stores = [] } = useQuery({
    queryKey: ["stores", "pf"],
    queryFn: () => fetchJson<Store[]>("/api/stores?type=PRODUIT_FINI"),
  });

  function set<K extends keyof typeof form>(key: K, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  /** À la sélection, l'atelier est pré-rempli avec la ligne de production de l'article. */
  function selectArticle(a: Article) {
    setArticle(a);
    if (a.productionLine && !form.atelier) {
      set("atelier", a.productionLine);
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!article) return setError("Veuillez sélectionner un article");
    if (!storeId) return setError("Veuillez sélectionner un magasin");
    setSubmitting(true);
    try {
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          articleId: article.id,
          storeId,
          description: form.description || article.designation,
          atelier: form.atelier,
          equipe: form.equipe,
          chefEquipe: form.chefEquipe,
          dateDebut: form.dateDebut ? new Date(form.dateDebut).toISOString() : "",
          dateFinPrev: form.dateFinPrev ? new Date(form.dateFinPrev).toISOString() : "",
          observation: form.observation,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Échec de création");
      router.push(`/orders/${data.id}`);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={submit} className="grid gap-6 lg:grid-cols-3">
      <Card className="lg:col-span-2">
        <CardContent className="space-y-4 pt-6">
          <div className="space-y-2">
            <Label>Article à fabriquer (référentiel ERP) *</Label>
            {article ? (
              <div className="flex items-center justify-between rounded-md border bg-accent/40 px-3 py-2">
                <div>
                  <p className="font-medium">{article.designation}</p>
                  <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                    <span className="font-mono">{article.code}</span>
                    {article.family && <Badge variant="secondary" className="h-4 px-1.5 text-[10px]">{article.family}</Badge>}
                    {article.productionLine && (
                      <Badge variant="default" className="h-4 gap-0.5 px-1.5 text-[10px]">
                        <Factory className="h-2.5 w-2.5" />
                        {article.productionLine}
                      </Badge>
                    )}
                    <span>· {article.unit}</span>
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
                    placeholder="Rechercher par code, désignation ou famille…"
                    value={articleQuery}
                    onChange={(e) => setArticleQuery(e.target.value)}
                    autoFocus
                  />
                  {isFetching && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
                </div>
                <ul className="max-h-64 overflow-y-auto">
                  {articles.length === 0 && (
                    <li className="px-3 py-6 text-center text-sm text-muted-foreground">
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
                          <span className="text-xs text-muted-foreground">
                            <span className="font-mono">{a.code}</span>
                            {a.family && ` · ${a.family}`}
                          </span>
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
                {articleData && (
                  <div className="border-t px-3 py-1.5 text-[11px] text-muted-foreground">
                    {articles.length} affiché(s) sur {articleData.total} article(s) fabricable(s)
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Atelier / Ligne" value={form.atelier} onChange={(v) => set("atelier", v)} />
            <Field label="Équipe" value={form.equipe} onChange={(v) => set("equipe", v)} />
            <Field label="Chef d'équipe" value={form.chefEquipe} onChange={(v) => set("chefEquipe", v)} />
            <Field label="Description" value={form.description} onChange={(v) => set("description", v)} />
            <Field label="Date début" type="datetime-local" value={form.dateDebut} onChange={(v) => set("dateDebut", v)} />
            <Field label="Date fin prévue" type="datetime-local" value={form.dateFinPrev} onChange={(v) => set("dateFinPrev", v)} />
          </div>
          <div className="space-y-2">
            <Label>Observation</Label>
            <textarea
              className="min-h-20 w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              value={form.observation}
              onChange={(e) => set("observation", e.target.value)}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-4 pt-6">
          <div className="space-y-2">
            <Label className="flex items-center gap-1.5">
              <Package className="h-3.5 w-3.5" /> Magasin de destination *
            </Label>
            <div className="space-y-1">
              {stores.length === 0 && (
                <p className="rounded-md border border-dashed px-3 py-4 text-center text-xs text-muted-foreground">
                  Aucun magasin produits finis. Lancez la synchronisation ERP.
                </p>
              )}
              {stores.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setStoreId(s.id)}
                  className={cn(
                    "flex w-full items-center justify-between gap-2 rounded-md border px-3 py-2 text-left text-sm transition-colors",
                    storeId === s.id ? "border-primary bg-accent" : "hover:bg-accent/50",
                  )}
                >
                  <span className="min-w-0">
                    <span className="block truncate font-medium">{s.designation}</span>
                    <span className="font-mono text-xs text-muted-foreground">{s.code}</span>
                  </span>
                  {storeId === s.id && <Check className="h-4 w-4 shrink-0 text-primary" />}
                </button>
              ))}
            </div>
          </div>

          {error && (
            <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>
          )}

          <Button type="submit" className="w-full" disabled={submitting}>
            {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
            Créer l'ordre de fabrication
          </Button>
          <p className="text-xs text-muted-foreground">
            Le numéro d'OF est généré automatiquement. L'OF démarre au statut « En production ».
          </p>
        </CardContent>
      </Card>
    </form>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
}) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <Input type={type} value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}
