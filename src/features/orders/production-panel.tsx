"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { Lock, Loader2, Save, AlertTriangle, Wand2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { cn, formatNumber } from "@/lib/utils";

interface ProdData {
  qtePrevue: number;
  qteProduite: number;
  qteBonne: number;
  qteRebut: number;
  causeRebut: string | null;
  causeRebutCode: string | null;
  causeRebutM5: string | null;
  tempsMachine: number | null;
  tempsOperateur: number | null;
  commentaires: string | null;
}

interface CauseGroup {
  category: string;
  causes: { code: string; label: string; category: string }[];
}

/**
 * Valeur sentinelle de l'option « Autre » : elle ne peut entrer en collision
 * avec un code du référentiel, qui n'utilise jamais ce préfixe.
 */
const AUTRE_OPTION = "__autre__";

export function ProductionPanel({
  orderId,
  initial,
  editable,
  locked,
  unit,
}: {
  orderId: string;
  initial: ProdData;
  editable: boolean;
  locked: boolean;
  unit?: string | null;
}) {
  const router = useRouter();
  const [form, setForm] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [isError, setIsError] = useState(false);
  // Saisie d'une cause de rebut absente du référentiel (option « Autre »)
  const [saisieLibre, setSaisieLibre] = useState(false);
  const [nouvelleCause, setNouvelleCause] = useState("");
  const [ajout, setAjout] = useState<{ enCours: boolean; erreur: string | null }>({
    enCours: false,
    erreur: null,
  });
  const disabled = !editable || locked;

  function set<K extends keyof ProdData>(key: K, value: ProdData[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  // Indicateurs calculés en direct pendant la saisie
  const kpi = useMemo(() => {
    const { qtePrevue, qteProduite, qteBonne, qteRebut, tempsMachine } = form;
    const somme = qteBonne + qteRebut;
    return {
      coherent: Math.abs(somme - qteProduite) < 0.001,
      ecartSomme: somme - qteProduite,
      tauxRebut: qteProduite > 0 ? (qteRebut / qteProduite) * 100 : 0,
      rendement: qteProduite > 0 ? (qteBonne / qteProduite) * 100 : 0,
      avancement: qtePrevue > 0 ? (qteProduite / qtePrevue) * 100 : 0,
      ecartPrevu: qteProduite - qtePrevue,
      cadence: tempsMachine && tempsMachine > 0 ? (qteProduite / tempsMachine) * 60 : null,
    };
  }, [form]);

  // Référentiel des causes de rebut (5M / Ishikawa)
  const { data: causeData, refetch: refetchCauses } = useQuery({
    queryKey: ["reject-causes"],
    queryFn: async () => {
      const res = await fetch("/api/reject-causes");
      if (!res.ok) throw new Error("Référentiel des causes indisponible");
      return res.json() as Promise<{ groups: CauseGroup[] }>;
    },
  });

  const causeManquante = form.qteRebut > 0 && !form.causeRebutCode?.trim();

  /** Sélection d'une cause : on mémorise le code, le libellé et l'axe 5M. */
  function selectCause(code: string) {
    const found = causeData?.groups
      .flatMap((g) => g.causes)
      .find((c) => c.code === code);
    setForm((f) => ({
      ...f,
      causeRebutCode: code || null,
      causeRebut: found?.label ?? null,
      causeRebutM5: found?.category ?? null,
    }));
  }

  /**
   * Cause absente du référentiel : elle y est ajoutée avant d'être
   * sélectionnée, pour rester disponible aux saisies suivantes et ne pas
   * fragmenter le Pareto des défauts.
   */
  async function ajouterCause() {
    const label = nouvelleCause.trim();
    if (!label) return;
    setAjout({ enCours: true, erreur: null });
    try {
      const res = await fetch("/api/reject-causes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ label }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.details?.[0]?.message ?? data.error ?? "Échec");
      }
      await refetchCauses();
      setForm((f) => ({
        ...f,
        causeRebutCode: data.code,
        causeRebut: data.label,
        causeRebutM5: data.category,
      }));
      setNouvelleCause("");
      setSaisieLibre(false);
      setAjout({ enCours: false, erreur: null });
    } catch (e) {
      setAjout({
        enCours: false,
        erreur: e instanceof Error ? e.message : "Erreur",
      });
    }
  }

  async function save() {
    setSaving(true);
    setMsg(null);
    setIsError(false);
    try {
      const res = await fetch(`/api/orders/${orderId}/production`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) {
        const detail = data.details?.[0]?.message;
        throw new Error(detail ?? data.error ?? "Échec");
      }
      setMsg("Saisie enregistrée");
      router.refresh();
    } catch (e) {
      setIsError(true);
      setMsg(e instanceof Error ? e.message : "Erreur");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      {locked && (
        <Badge variant="warning" className="gap-1">
          <Lock className="h-3 w-3" /> Données verrouillées après validation
        </Badge>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <NumField label={`Quantité prévue${unit ? ` (${unit})` : ""}`} value={form.qtePrevue} disabled={disabled} onChange={(v) => set("qtePrevue", v)} />
        <NumField label="Quantité produite" value={form.qteProduite} disabled={disabled} onChange={(v) => set("qteProduite", v)} invalid={!kpi.coherent} />
        <NumField label="Quantité bonne" value={form.qteBonne} disabled={disabled} onChange={(v) => set("qteBonne", v)} invalid={!kpi.coherent} />
        <NumField label="Quantité rebut" value={form.qteRebut} disabled={disabled} onChange={(v) => set("qteRebut", v)} invalid={!kpi.coherent} />
      </div>

      {/* Contrôle de cohérence */}
      {!kpi.coherent && (
        <div className="flex flex-wrap items-center gap-3 rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm">
          <AlertTriangle className="h-4 w-4 shrink-0 text-destructive" />
          <span className="text-destructive">
            Incohérence : bonne + rebut = {formatNumber(form.qteBonne + form.qteRebut)} ≠ produite ={" "}
            {formatNumber(form.qteProduite)} (écart {kpi.ecartSomme > 0 ? "+" : ""}
            {formatNumber(kpi.ecartSomme)})
          </span>
          {!disabled && (
            <button
              type="button"
              onClick={() => set("qteBonne", Math.max(0, form.qteProduite - form.qteRebut))}
              className="ml-auto inline-flex items-center gap-1.5 rounded-md border border-primary/40 bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary hover:bg-primary/20"
            >
              <Wand2 className="h-3 w-3" /> Ajuster la quantité bonne
            </button>
          )}
        </div>
      )}

      {/* Indicateurs de performance en direct */}
      {form.qteProduite > 0 && (
        <div className="grid grid-cols-2 gap-3 rounded-lg border bg-muted/30 p-3 sm:grid-cols-4">
          <Metric label="Rendement" value={`${formatNumber(kpi.rendement, 1)} %`} tone={kpi.rendement >= 95 ? "success" : kpi.rendement >= 90 ? "warning" : "destructive"} />
          <Metric label="Taux de rebut" value={`${formatNumber(kpi.tauxRebut, 1)} %`} tone={kpi.tauxRebut <= 3 ? "success" : kpi.tauxRebut <= 5 ? "warning" : "destructive"} />
          <Metric label="Avancement / prévu" value={`${formatNumber(kpi.avancement, 0)} %`} hint={`${kpi.ecartPrevu >= 0 ? "+" : ""}${formatNumber(kpi.ecartPrevu)}`} />
          <Metric label="Cadence" value={kpi.cadence !== null ? `${formatNumber(kpi.cadence, 1)} /h` : "—"} hint="sur temps machine" />
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <NumField label="Temps machine (min)" value={form.tempsMachine} disabled={disabled} onChange={(v) => set("tempsMachine", v)} />
        <NumField label="Temps opérateur (min)" value={form.tempsOperateur} disabled={disabled} onChange={(v) => set("tempsOperateur", v)} />
        <div className="space-y-2 sm:col-span-2">
          <Label>
            Cause rebut (5M)
            {form.qteRebut > 0 && <span className="ml-1 text-destructive">*</span>}
          </Label>
          <select
            value={saisieLibre ? AUTRE_OPTION : (form.causeRebutCode ?? "")}
            disabled={disabled}
            onChange={(e) => {
              const v = e.target.value;
              setAjout({ enCours: false, erreur: null });
              setSaisieLibre(v === AUTRE_OPTION);
              if (v !== AUTRE_OPTION) selectCause(v);
            }}
            className={cn(
              "h-9 w-full rounded-md border border-input bg-background px-3 text-sm shadow-sm transition-colors disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              causeManquante && "border-destructive",
            )}
          >
            <option value="">
              {form.qteRebut > 0 ? "— Sélectionner une cause —" : "— Aucune —"}
            </option>
            {causeData?.groups.map((g) => (
              <optgroup key={g.category} label={g.category}>
                {g.causes.map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.label}
                  </option>
                ))}
              </optgroup>
            ))}
            <option value={AUTRE_OPTION}>Autre — préciser…</option>
          </select>

          {saisieLibre && !disabled && (
            <div className="space-y-2 rounded-md border border-dashed bg-muted/30 p-3">
              <Label htmlFor="cause-libre" className="text-xs">
                Nouvelle cause de rebut
              </Label>
              <div className="flex gap-2">
                <Input
                  id="cause-libre"
                  value={nouvelleCause}
                  maxLength={80}
                  placeholder="ex. Décollement des arêtes"
                  onChange={(e) => setNouvelleCause(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      void ajouterCause();
                    }
                  }}
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => void ajouterCause()}
                  disabled={ajout.enCours || nouvelleCause.trim().length < 3}
                >
                  {ajout.enCours ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Plus className="h-4 w-4" />
                  )}
                  Ajouter
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Elle sera ajoutée au référentiel sous « Autre » et proposée aux
                prochaines saisies.
              </p>
              {ajout.erreur && (
                <p className="text-xs text-destructive">{ajout.erreur}</p>
              )}
            </div>
          )}

          {form.causeRebutM5 && !saisieLibre && (
            <p className="text-xs text-muted-foreground">
              Axe 5M : <span className="font-medium text-foreground">{form.causeRebutM5}</span>
            </p>
          )}
          {causeManquante && !saisieLibre && (
            <p className="text-xs text-destructive">
              Requise pour l'analyse des causes (Pareto des défauts et diagramme d'Ishikawa).
            </p>
          )}
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
          {/* Tant que la cause libre n'est pas ajoutée au référentiel, elle
              n'est rattachée à rien : enregistrer retomberait en silence sur
              la cause précédente. */}
          <Button
            onClick={save}
            disabled={saving || !kpi.coherent || causeManquante || saisieLibre}
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Enregistrer la saisie
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

function Metric({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: "success" | "warning" | "destructive";
}) {
  return (
    <div>
      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p
        className={cn(
          "text-lg font-bold",
          tone === "success" && "text-success",
          tone === "warning" && "text-warning",
          tone === "destructive" && "text-destructive",
        )}
      >
        {value}
      </p>
      {hint && <p className="text-[11px] text-muted-foreground">{hint}</p>}
    </div>
  );
}

function NumField({
  label,
  value,
  onChange,
  disabled,
  invalid,
}: {
  label: string;
  value: number | null;
  onChange: (v: number) => void;
  disabled: boolean;
  invalid?: boolean;
}) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <Input
        type="number"
        step="any"
        value={value ?? ""}
        disabled={disabled}
        className={cn(invalid && "border-destructive")}
        onChange={(e) => onChange(e.target.value === "" ? 0 : Number(e.target.value))}
      />
    </div>
  );
}
