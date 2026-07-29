"use client";

import { useState } from "react";
import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { Search, Loader2, Factory } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";

interface Article {
  id: string;
  code: string;
  designation: string;
  family: string | null;
  unit: string | null;
  itemType: string;
  erpCategory: string | null;
  productionLine: string | null;
  isManufactured: boolean;
}

const TYPE_LABELS: Record<string, { label: string; variant: "default" | "secondary" | "success" | "warning" | "outline" }> = {
  PRODUIT_FINI: { label: "Produit fini", variant: "success" },
  SEMI_FINI: { label: "Semi-fini", variant: "default" },
  MATIERE_PREMIERE: { label: "Matière première", variant: "warning" },
  CONSOMMABLE: { label: "Consommable", variant: "secondary" },
  PIECE_RECHANGE: { label: "Pièce de rechange", variant: "secondary" },
  AUTRE: { label: "Autre", variant: "outline" },
};

export function ArticlesBrowser({
  families,
  lines,
}: {
  families: string[];
  lines: string[];
}) {
  const [q, setQ] = useState("");
  const [family, setFamily] = useState("");
  const [line, setLine] = useState("");
  const [manufacturedOnly, setManufacturedOnly] = useState(false);

  const { data, isFetching } = useQuery({
    queryKey: ["articles-browser", q, family, line, manufacturedOnly],
    queryFn: async () => {
      const params = new URLSearchParams({ take: "100" });
      if (q) params.set("q", q);
      if (family) params.set("family", family);
      if (line) params.set("line", line);
      if (manufacturedOnly) params.set("manufactured", "1");
      const res = await fetch(`/api/articles?${params}`);
      if (!res.ok) throw new Error("Erreur de chargement");
      return res.json() as Promise<{ items: Article[]; total: number; returned: number }>;
    },
    placeholderData: keepPreviousData,
  });

  const items = data?.items ?? [];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex h-9 min-w-64 flex-1 items-center gap-2 rounded-md border bg-background px-3">
          <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
          <input
            className="flex-1 bg-transparent text-sm outline-none"
            placeholder="Rechercher un code, une désignation, une famille…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          {isFetching && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
        </div>

        <select
          className="h-9 rounded-md border bg-background px-2 text-sm"
          value={family}
          onChange={(e) => setFamily(e.target.value)}
        >
          <option value="">Toutes les familles</option>
          {families.map((f) => (
            <option key={f} value={f}>{f}</option>
          ))}
        </select>

        <select
          className="h-9 rounded-md border bg-background px-2 text-sm"
          value={line}
          onChange={(e) => setLine(e.target.value)}
        >
          <option value="">Toutes les lignes</option>
          {lines.map((l) => (
            <option key={l} value={l}>{l}</option>
          ))}
        </select>

        <button
          type="button"
          onClick={() => setManufacturedOnly((v) => !v)}
          className={cn(
            "h-9 rounded-md border px-3 text-sm font-medium transition-colors",
            manufacturedOnly
              ? "border-primary bg-primary/10 text-primary"
              : "text-muted-foreground hover:bg-accent",
          )}
        >
          Fabricables uniquement
        </button>
      </div>

      <p className="text-sm text-muted-foreground">
        {data ? `${data.returned} affiché(s) sur ${data.total} article(s)` : "Chargement…"}
      </p>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Code</TableHead>
            <TableHead>Désignation</TableHead>
            <TableHead>Famille</TableHead>
            <TableHead>Nature</TableHead>
            <TableHead>Ligne</TableHead>
            <TableHead>Unité</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.length === 0 && (
            <TableRow>
              <TableCell colSpan={6} className="py-10 text-center text-muted-foreground">
                Aucun article ne correspond aux critères.
              </TableCell>
            </TableRow>
          )}
          {items.map((a) => {
            const t = TYPE_LABELS[a.itemType] ?? TYPE_LABELS.AUTRE;
            return (
              <TableRow key={a.id}>
                <TableCell className="font-mono text-xs">{a.code}</TableCell>
                <TableCell className="font-medium">{a.designation}</TableCell>
                <TableCell className="text-sm text-muted-foreground">{a.family ?? "—"}</TableCell>
                <TableCell><Badge variant={t.variant}>{t.label}</Badge></TableCell>
                <TableCell>
                  {a.productionLine ? (
                    <span className="inline-flex items-center gap-1 text-sm">
                      <Factory className="h-3 w-3 text-muted-foreground" />
                      {a.productionLine}
                    </span>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </TableCell>
                <TableCell className="text-sm">{a.unit ?? "—"}</TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
