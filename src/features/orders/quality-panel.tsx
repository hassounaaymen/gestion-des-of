"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import {
  Lock, Loader2, Save, CheckCircle2, AlertTriangle, Ruler, Sparkles, Scale, Wand2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { cn, formatNumber } from "@/lib/utils";
import { evaluatePlan, formatRange, type ControlPoint } from "@/lib/quality-eval";
import { reconcile, formatEcart, type ProductionDeclaration } from "@/lib/reconciliation";

interface QualData {
  controleur: string | null;
  qteControlee: number;
  qteConforme: number;
  qteNonConforme: number;
  longueur: number | null;
  largeur: number | null;
  hauteur: number | null;
  poids: number | null;
  resistance: number | null;
  aspect: string | null;
  couleur: string | null;
  humidite: number | null;
  commentaires: string | null;
  decision: "CONFORME" | "PARTIEL" | "NON_CONFORME" | "EN_ATTENTE";
}

const DECISIONS: { value: QualData["decision"]; label: string; cls: string }[] = [
  { value: "CONFORME", label: "Conforme", cls: "border-success text-success" },
  { value: "PARTIEL", label: "Conforme partiel", cls: "border-warning text-warning" },
  { value: "NON_CONFORME", label: "Non conforme", cls: "border-destructive text-destructive" },
  { value: "EN_ATTENTE", label: "En attente", cls: "border-muted-foreground text-muted-foreground" },
];

export function QualityPanel({
  orderId,
  initial,
  production,
  editable,
  locked,
  unit,
}: {
  orderId: string;
  initial: QualData;
  production: ProductionDeclaration;
  editable: boolean;
  locked: boolean;
  unit?: string | null;
}) {
  const router = useRouter();
  const [form, setForm] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [isError, setIsError] = useState(false);
  const disabled = !editable || locked;

  const { data: plan } = useQuery({
    queryKey: ["control-plan", orderId],
    queryFn: async () => {
      const res = await fetch(`/api/orders/${orderId}/control-plan`);
      if (!res.ok) throw new Error("Plan de contrôle indisponible");
      return res.json() as Promise<{ family: string | null; points: ControlPoint[] }>;
    },
  });

  const evaluation = useMemo(() => {
    if (!plan?.points) return null;
    return evaluatePlan(plan.points, {
      longueur: form.longueur,
      largeur: form.largeur,
      hauteur: form.hauteur,
      resistance: form.resistance,
      humidite: form.humidite,
    });
  }, [plan, form.longueur, form.largeur, form.hauteur, form.resistance, form.humidite]);

  // Réconciliation avec la déclaration Production
  const rec = useMemo(
    () =>
      reconcile(production, {
        qteControlee: form.qteControlee,
        qteConforme: form.qteConforme,
        qteNonConforme: form.qteNonConforme,
      }),
    [production, form.qteControlee, form.qteConforme, form.qteNonConforme],
  );

  /** Décision proposée : les quantités priment, les mesures peuvent durcir le verdict. */
  const suggested = useMemo(() => {
    if (evaluation?.criticalFailures.length) return "NON_CONFORME" as const;
    return rec.suggestedDecision;
  }, [evaluation, rec.suggestedDecision]);

  function set<K extends keyof QualData>(key: K, value: QualData[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function save() {
    setSaving(true);
    setMsg(null);
    setIsError(false);
    try {
      const res = await fetch(`/api/orders/${orderId}/quality`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.details?.[0]?.message ?? data.error ?? "Échec");
      setMsg("Contrôle enregistré");
      router.refresh();
    } catch (e) {
      setIsError(true);
      setMsg(e instanceof Error ? e.message : "Erreur");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-5">
      {locked && (
        <Badge variant="success" className="gap-1">
          <Lock className="h-3 w-3" /> Contrôle qualité validé et verrouillé
        </Badge>
      )}

      {/* ── Validation quantitative ───────────────────── */}
      <div className="space-y-3">
        <Label className="flex items-center gap-1.5">
          <Scale className="h-3.5 w-3.5" /> Validation quantitative
        </Label>

        <div className="grid gap-4 sm:grid-cols-3">
          <NumField
            label={`Quantité contrôlée${unit ? ` (${unit})` : ""}`}
            value={form.qteControlee}
            disabled={disabled}
            invalid={!rec.coherent}
            onChange={(v) => set("qteControlee", v)}
          />
          <NumField
            label="Quantité conforme"
            value={form.qteConforme}
            disabled={disabled}
            invalid={!rec.coherent}
            onChange={(v) => set("qteConforme", v)}
          />
          <NumField
            label="Quantité non conforme"
            value={form.qteNonConforme}
            disabled={disabled}
            invalid={!rec.coherent}
            // Le contrôleur ne saisit que le refus : le conforme s'en déduit.
            onChange={(v) =>
              setForm((f) => ({
                ...f,
                qteNonConforme: v,
                qteConforme: Math.max(0, f.qteControlee - v),
              }))
            }
          />
        </div>

        {!rec.coherent && (
          <div className="flex flex-wrap items-center gap-3 rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm">
            <AlertTriangle className="h-4 w-4 shrink-0 text-destructive" />
            <span className="text-destructive">
              Incohérence : conforme + non conforme = {formatNumber(form.qteConforme + form.qteNonConforme)} ≠
              contrôlée = {formatNumber(form.qteControlee)}
            </span>
            {!disabled && (
              <button
                type="button"
                onClick={() => set("qteConforme", Math.max(0, form.qteControlee - form.qteNonConforme))}
                className="ml-auto inline-flex items-center gap-1.5 rounded-md border border-primary/40 bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary hover:bg-primary/20"
              >
                <Wand2 className="h-3 w-3" /> Ajuster la quantité conforme
              </button>
            )}
          </div>
        )}

        {/* Confrontation Production ↔ Qualité */}
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr className="text-xs uppercase tracking-wide text-muted-foreground">
                <th className="px-3 py-2 text-left font-semibold">Déclaration</th>
                <th className="px-3 py-2 text-right font-semibold">Total</th>
                <th className="px-3 py-2 text-right font-semibold">Bon / Conforme</th>
                <th className="px-3 py-2 text-right font-semibold">Rebut / Refusé</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-t">
                <td className="px-3 py-2 font-medium">Production</td>
                <td className="px-3 py-2 text-right">{formatNumber(production.qteProduite)}</td>
                <td className="px-3 py-2 text-right">{formatNumber(production.qteBonne)}</td>
                <td className="px-3 py-2 text-right">{formatNumber(production.qteRebut)}</td>
              </tr>
              <tr className="border-t">
                <td className="px-3 py-2 font-medium">Qualité</td>
                <td className="px-3 py-2 text-right">{formatNumber(form.qteControlee)}</td>
                <td className="px-3 py-2 text-right">{formatNumber(form.qteConforme)}</td>
                <td className="px-3 py-2 text-right">{formatNumber(form.qteNonConforme)}</td>
              </tr>
              <tr className={cn("border-t font-semibold", rec.hasEcart && "bg-warning/5")}>
                <td className="px-3 py-2">Écart</td>
                <td className={cn("px-3 py-2 text-right", Math.abs(rec.ecartPresente) > 0.001 && "text-warning")}>
                  {formatEcart(rec.ecartPresente)}
                </td>
                <td className={cn("px-3 py-2 text-right", Math.abs(rec.ecartConforme) > 0.001 && "text-destructive")}>
                  {formatEcart(rec.ecartConforme)}
                </td>
                <td className={cn("px-3 py-2 text-right", Math.abs(rec.ecartRebut) > 0.001 && "text-destructive")}>
                  {formatEcart(rec.ecartRebut)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {form.qteControlee > 0 && (
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2 rounded-lg border bg-muted/30 px-3 py-2 text-sm">
            <span>
              Taux de conformité{" "}
              <span
                className={cn(
                  "font-bold",
                  rec.tauxConformite >= 95 ? "text-success" : rec.tauxConformite >= 90 ? "text-warning" : "text-destructive",
                )}
              >
                {formatNumber(rec.tauxConformite, 1)} %
              </span>
            </span>
            {rec.hasEcart && (
              <Badge variant={rec.level === "MAJEUR" ? "destructive" : "warning"} className="gap-1">
                <AlertTriangle className="h-3 w-3" />
                Écart {rec.level === "MAJEUR" ? "majeur" : "mineur"} avec la Production
                {rec.ecartConformePct > 0 && ` (${formatNumber(rec.ecartConformePct, 1)} %)`}
              </Badge>
            )}
            {!disabled && suggested !== "EN_ATTENTE" && form.decision !== suggested && (
              <button
                type="button"
                onClick={() => set("decision", suggested)}
                className="ml-auto inline-flex items-center gap-1.5 rounded-md border border-primary/40 bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary hover:bg-primary/20"
              >
                <Sparkles className="h-3 w-3" />
                Appliquer la décision proposée :{" "}
                {DECISIONS.find((d) => d.value === suggested)?.label}
              </button>
            )}
          </div>
        )}
      </div>

      {/* ── Points de contrôle dimensionnels ──────────── */}
      {evaluation && evaluation.points.length > 0 && (
        <div className="space-y-2">
          <Label className="flex items-center gap-1.5">
            <Ruler className="h-3.5 w-3.5" /> Points de contrôle
            {plan?.family && (
              <span className="font-normal text-muted-foreground">— plan « {plan.family} »</span>
            )}
            <span className="font-normal text-muted-foreground">
              · {evaluation.measured}/{evaluation.total} mesurés
            </span>
          </Label>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {evaluation.points.map((p) => {
              const fail = p.verdict === "HORS_TOLERANCE";
              const pass = p.verdict === "OK" && (p.min !== null || p.max !== null);
              return (
                <div
                  key={p.parameter}
                  className={cn(
                    "rounded-lg border p-3 transition-colors",
                    fail && "border-destructive/50 bg-destructive/5",
                    pass && "border-success/50 bg-success/5",
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <Label className="text-xs">
                      {p.label}
                      {p.isCritical && <span className="ml-1 text-destructive">*</span>}
                    </Label>
                    {fail && <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-destructive" />}
                    {pass && <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-success" />}
                  </div>
                  <Input
                    type="number"
                    step="any"
                    className="mt-1.5 h-8"
                    value={(form[p.parameter as keyof QualData] as number | null) ?? ""}
                    disabled={disabled}
                    onChange={(e) =>
                      set(
                        p.parameter as keyof QualData,
                        (e.target.value === "" ? null : Number(e.target.value)) as never,
                      )
                    }
                  />
                  <p className="mt-1.5 text-[11px] text-muted-foreground">
                    {p.nominal !== null && (
                      <span className="font-medium text-foreground">
                        Nominal {formatNumber(p.nominal)} {p.unit}
                      </span>
                    )}
                    {p.nominal !== null && " · "}
                    Tolérance {formatRange(p)}
                    {p.deviation !== null && p.value !== null && (
                      <span className={cn("ml-1 font-medium", fail ? "text-destructive" : "text-success")}>
                        ({formatEcart(p.deviation, 1)})
                      </span>
                    )}
                  </p>
                </div>
              );
            })}
          </div>
          <p className="text-[11px] text-muted-foreground">
            * Point critique — un dépassement entraîne une non-conformité bloquante.
          </p>
        </div>
      )}

      {/* ── Informations complémentaires ──────────────── */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <TextField label="Contrôleur" value={form.controleur ?? ""} disabled={disabled} onChange={(v) => set("controleur", v)} />
        <OptNumField label="Poids (kg)" value={form.poids} disabled={disabled} onChange={(v) => set("poids", v)} />
        <TextField label="Aspect" value={form.aspect ?? ""} disabled={disabled} onChange={(v) => set("aspect", v)} />
        <TextField label="Couleur" value={form.couleur ?? ""} disabled={disabled} onChange={(v) => set("couleur", v)} />
      </div>

      <div className="space-y-2">
        <Label>Décision</Label>
        <div className="flex flex-wrap gap-2">
          {DECISIONS.map((d) => (
            <button
              key={d.value}
              type="button"
              disabled={disabled}
              onClick={() => set("decision", d.value)}
              className={cn(
                "rounded-md border-2 px-4 py-2 text-sm font-medium transition-colors disabled:opacity-60",
                form.decision === d.value ? d.cls + " bg-accent/40" : "border-border text-muted-foreground",
              )}
            >
              {d.label}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <Label>Commentaires</Label>
        <textarea
          className="min-h-16 w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          value={form.commentaires ?? ""}
          disabled={disabled}
          onChange={(e) => set("commentaires", e.target.value)}
        />
      </div>

      {editable && !locked && (
        <div className="flex items-center gap-3">
          <Button onClick={save} disabled={saving || !rec.coherent}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Enregistrer le contrôle
          </Button>
          {msg && (
            <span className={cn("text-sm", isError ? "text-destructive" : "text-muted-foreground")}>
              {msg}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

function TextField({ label, value, onChange, disabled }: { label: string; value: string; onChange: (v: string) => void; disabled: boolean }) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <Input value={value} disabled={disabled} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}

function NumField({ label, value, onChange, disabled, invalid }: { label: string; value: number; onChange: (v: number) => void; disabled: boolean; invalid?: boolean }) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <Input
        type="number"
        step="any"
        value={value}
        disabled={disabled}
        className={cn(invalid && "border-destructive")}
        onChange={(e) => onChange(e.target.value === "" ? 0 : Number(e.target.value))}
      />
    </div>
  );
}

function OptNumField({ label, value, onChange, disabled }: { label: string; value: number | null; onChange: (v: number | null) => void; disabled: boolean }) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <Input
        type="number"
        step="any"
        value={value ?? ""}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value === "" ? null : Number(e.target.value))}
      />
    </div>
  );
}
