"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

interface SyncReport {
  articles: { fetched: number; created: number; updated: number };
  stores: { fetched: number; created: number; updated: number };
  durationMs: number;
}

export function SyncErpButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [isError, setIsError] = useState(false);

  async function sync() {
    setLoading(true);
    setMsg(null);
    setIsError(false);
    try {
      const res = await fetch("/api/erp/sync", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Échec de la synchronisation");
      const r = data as SyncReport;
      setMsg(
        `${r.articles.fetched} articles (${r.articles.created} nouveaux, ${r.articles.updated} màj) · ` +
          `${r.stores.fetched} magasins · ${(r.durationMs / 1000).toFixed(1)}s`,
      );
      router.refresh();
    } catch (e) {
      setIsError(true);
      setMsg(e instanceof Error ? e.message : "Erreur");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex items-center gap-3">
      {msg && (
        <span className={`text-xs ${isError ? "text-destructive" : "text-muted-foreground"}`}>
          {msg}
        </span>
      )}
      <Button variant="outline" onClick={sync} disabled={loading}>
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
        {loading ? "Synchronisation…" : "Synchroniser l'ERP"}
      </Button>
    </div>
  );
}
