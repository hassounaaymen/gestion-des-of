"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { CalendarRange, Factory, RotateCcw } from "lucide-react";
import { Label } from "@/components/ui/label";

/** Filtres du planning : fenêtre de dates et unité de production (usine). */
export function PlanningFilters({
  from,
  to,
  usine,
  unites,
}: {
  /** yyyy-MM-dd */
  from: string;
  to: string;
  usine: string | null;
  unites: string[];
}) {
  const router = useRouter();
  const params = useSearchParams();

  function apply(next: Record<string, string | null>) {
    const q = new URLSearchParams(params.toString());
    // Une fenêtre explicite remplace la navigation par périodes
    q.delete("offset");
    q.delete("days");
    for (const [k, v] of Object.entries(next)) {
      if (v) q.set(k, v);
      else q.delete(k);
    }
    router.push(`/planning?${q.toString()}`);
  }

  const filtered = Boolean(usine) || params.has("from") || params.has("to");

  return (
    <div className="mb-4 flex flex-wrap items-end gap-3 rounded-lg border bg-card p-3">
      <div className="space-y-1">
        <Label htmlFor="f-from" className="flex items-center gap-1.5 text-xs">
          <CalendarRange className="h-3.5 w-3.5" /> Du
        </Label>
        <input
          id="f-from"
          type="date"
          value={from}
          max={to}
          onChange={(e) => apply({ from: e.target.value, to })}
          className="h-9 rounded-md border border-input bg-background px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
      </div>

      <div className="space-y-1">
        <Label htmlFor="f-to" className="text-xs">Au</Label>
        <input
          id="f-to"
          type="date"
          value={to}
          min={from}
          onChange={(e) => apply({ from, to: e.target.value })}
          className="h-9 rounded-md border border-input bg-background px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
      </div>

      {unites.length > 0 && (
        <div className="space-y-1">
          <Label htmlFor="f-usine" className="flex items-center gap-1.5 text-xs">
            <Factory className="h-3.5 w-3.5" /> Usine
          </Label>
          <select
            id="f-usine"
            value={usine ?? ""}
            onChange={(e) => apply({ usine: e.target.value || null })}
            className="h-9 rounded-md border border-input bg-background px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <option value="">Toutes les usines</option>
            {unites.map((u) => (
              <option key={u} value={u}>{u}</option>
            ))}
          </select>
        </div>
      )}

      {filtered && (
        <button
          type="button"
          onClick={() => router.push("/planning")}
          className="inline-flex h-9 items-center gap-1.5 rounded-md border border-input px-3 text-sm text-muted-foreground transition-colors hover:bg-accent"
        >
          <RotateCcw className="h-3.5 w-3.5" /> Réinitialiser
        </button>
      )}
    </div>
  );
}
