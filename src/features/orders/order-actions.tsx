"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, ShieldCheck, Lock, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { OrderStatus } from "@prisma/client";

interface Perms {
  validateProduction: boolean;
  validateQuality: boolean;
  close: boolean;
}

export function OrderActions({
  orderId,
  status,
  perms,
}: {
  orderId: string;
  status: OrderStatus;
  perms: Perms;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function act(path: string, key: string) {
    setLoading(key);
    setError(null);
    try {
      const res = await fetch(`/api/orders/${orderId}/${path}`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Échec");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur");
    } finally {
      setLoading(null);
    }
  }

  const actions: React.ReactNode[] = [];
  if (status === "IN_PRODUCTION" && perms.validateProduction) {
    actions.push(
      <Button key="vp" onClick={() => act("validate-production", "vp")} disabled={!!loading}>
        {loading === "vp" ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
        Valider la production
      </Button>,
    );
  }
  if (status === "PRODUCTION_VALIDATED" && perms.validateQuality) {
    actions.push(
      <Button key="vq" variant="success" onClick={() => act("validate-quality", "vq")} disabled={!!loading}>
        {loading === "vq" ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
        Valider la qualité
      </Button>,
    );
  }
  // Approbation finale : réservée au directeur d'usine (voir `order:close`)
  if (status === "QUALITY_VALIDATED" && perms.close) {
    actions.push(
      <Button key="cl" onClick={() => act("close", "cl")} disabled={!!loading}>
        {loading === "cl" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Lock className="h-4 w-4" />}
        Approuver et clôturer l'OF
      </Button>,
    );
  }

  if (actions.length === 0 && !error) return null;

  return (
    <div className="flex flex-wrap items-center gap-3">
      {actions}
      {error && <span className="text-sm text-destructive">{error}</span>}
    </div>
  );
}
