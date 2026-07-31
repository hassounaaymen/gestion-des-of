import Link from "next/link";
import { redirect } from "next/navigation";
import { CalendarClock, AlertTriangle, ChevronLeft, ChevronRight, FileText } from "lucide-react";
import { getPlanning } from "@/services/planning.service";
import { getSession } from "@/lib/session";
import { can, scopeUsine } from "@/lib/rbac";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ORDER_STATUS } from "@/lib/status";
import { PlanButton } from "@/features/planning/plan-button";
import { PlanningSlots, CreateOrderButton } from "@/features/planning/planning-slots";
import { PlanningFilters } from "@/features/planning/planning-filters";
import { formatDate, formatNumber, cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

/** Marqueur visuel d'urgence sur la barre de Gantt. */
const PRIORITE_MARK: Record<string, string> = {
  URGENTE: "⚑ ",
  HAUTE: "▲ ",
  NORMALE: "",
  BASSE: "",
};

const PRIORITE_LABEL: Record<string, string> = {
  URGENTE: "urgente",
  HAUTE: "haute",
  NORMALE: "normale",
  BASSE: "basse",
};

/** Couleur de la barre selon l'état d'avancement de l'OF. */
function barTone(status: string, late: boolean) {
  if (late) return "bg-destructive/80 hover:bg-destructive";
  if (status === "QUALITY_VALIDATED") return "bg-success/80 hover:bg-success";
  if (status === "PRODUCTION_VALIDATED") return "bg-warning/80 hover:bg-warning";
  return "bg-primary/80 hover:bg-primary";
}

export default async function PlanningPage({
  searchParams,
}: {
  searchParams: Promise<{
    offset?: string;
    days?: string;
    from?: string;
    to?: string;
    usine?: string;
  }>;
}) {
  const session = await getSession();
  if (!session || !can(session.role, "planning:read")) redirect("/dashboard");

  const sp = await searchParams;
  const offset = Number(sp.offset ?? 0) || 0;
  const horizon = Math.min(Math.max(Number(sp.days ?? 14), 7), 28);

  // Une fenêtre explicite (filtre de dates) prime sur la navigation par périodes
  const explicitFrom = sp.from ? new Date(`${sp.from}T00:00:00`) : null;
  const explicitTo = sp.to ? new Date(`${sp.to}T00:00:00`) : null;

  const start = explicitFrom ?? new Date();
  start.setHours(0, 0, 0, 0);
  if (!explicitFrom) start.setDate(start.getDate() + offset * horizon);

  // Un utilisateur rattaché à une usine ne peut pas élargir son périmètre
  // via l'URL : sa portée écrase toujours le filtre demandé.
  const portee = scopeUsine(session);
  const usineFiltre = portee ?? sp.usine ?? null;

  const data = await getPlanning({
    from: start,
    to: explicitTo ?? undefined,
    days: explicitTo ? undefined : horizon,
    usine: usineFiltre,
  });

  const isoDay = (d: Date) => d.toISOString().slice(0, 10);
  /** Conserve les filtres actifs dans les liens de navigation et d'export. */
  const keep = (extra: Record<string, string>) => {
    const q = new URLSearchParams(extra);
    if (sp.usine) q.set("usine", sp.usine);
    if (sp.from) q.set("from", sp.from);
    if (sp.to) q.set("to", sp.to);
    return q.toString();
  };
  const canPlan = can(session.role, "planning:write");
  const canCreate = can(session.role, "order:create");
  // Jours transmis au composant client (sérialisables)
  const clientDays = data.days.map((d) => ({
    iso: d.iso,
    label: d.label,
    isWeekend: d.isWeekend,
  }));

  /** Adapte une ligne de planning au format attendu par la boîte de dialogue. */
  const toTarget = (o: (typeof data.unplanned)[number]) => ({
    id: o.id,
    number: o.number,
    articleDesignation: o.articleDesignation,
    dateDebut: o.dateDebut ? o.dateDebut.toISOString() : null,
    dateFinPrev: o.dateFinPrev ? o.dateFinPrev.toISOString() : null,
    atelier: o.atelier === "Non affecté" ? null : o.atelier,
    equipe: o.equipe,
    chefEquipe: o.chefEquipe,
    priorite: o.priorite,
    suggestedAtelier: o.suggestedAtelier,
  });

  return (
    <div>
      <PageHeader
        title="Planning de production"
        description={
          `Charge par atelier du ${formatDate(data.from)} au ${formatDate(data.to)} — ` +
          `${data.totalOrders} OF actifs` +
          (data.usine ? ` · ${data.usine}` : "")
        }
        action={
          <div className="flex items-center gap-2">
            {canCreate && (
              <CreateOrderButton ateliers={data.knownAteliers} className="mr-1" />
            )}
            {can(session.role, "report:export") && (
              <a
                href={`/api/export/pdf?type=planning&${keep({ offset: String(offset), days: String(horizon) })}`}
                className="inline-flex h-9 items-center gap-2 rounded-md border border-input bg-background px-3 text-sm font-medium transition-colors hover:bg-accent"
                title="Fiche planning PDF (paysage, à afficher en atelier)"
              >
                <FileText className="h-4 w-4" />
                Fiche PDF
              </a>
            )}
            <Button variant="outline" size="icon" asChild>
              <Link
                href={`/planning?offset=${offset - 1}&days=${horizon}${sp.usine ? `&usine=${encodeURIComponent(sp.usine)}` : ""}`}
                aria-label="Période précédente"
              >
                <ChevronLeft className="h-4 w-4" />
              </Link>
            </Button>
            <Button variant="outline" size="sm" asChild>
              <Link href={`/planning?days=${horizon}${sp.usine ? `&usine=${encodeURIComponent(sp.usine)}` : ""}`}>
                Aujourd'hui
              </Link>
            </Button>
            <Button variant="outline" size="icon" asChild>
              <Link
                href={`/planning?offset=${offset + 1}&days=${horizon}${sp.usine ? `&usine=${encodeURIComponent(sp.usine)}` : ""}`}
                aria-label="Période suivante"
              >
                <ChevronRight className="h-4 w-4" />
              </Link>
            </Button>
          </div>
        }
      />

      <PlanningFilters
        from={isoDay(data.from)}
        to={isoDay(data.to)}
        usine={data.usine}
        unites={portee ? [] : data.knownUnites}
      />

      {data.ateliers.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-4 py-12 text-center">
            <p className="text-sm text-muted-foreground">
              Aucun OF planifié sur cette période.
            </p>
            {canCreate && <CreateOrderButton ateliers={data.knownAteliers} />}
          </CardContent>
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <div className="min-w-[900px]">
              {/* En-tête calendrier */}
              <div className="flex border-b bg-muted/40">
                <div className="w-56 shrink-0 border-r px-3 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Atelier / Ligne
                </div>
                <div className="flex flex-1">
                  {data.days.map((d) => (
                    <div
                      key={d.label}
                      className={cn(
                        "flex-1 border-r px-1 py-2 text-center text-[11px] last:border-r-0",
                        d.isWeekend && "bg-muted/60",
                        d.isToday && "bg-primary/10 font-bold text-primary",
                      )}
                    >
                      <div className="text-muted-foreground">{d.dayName}</div>
                      <div className={cn("font-medium", d.isToday && "text-primary")}>{d.label}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Lignes par atelier */}
              {data.ateliers.map((a) => (
                <div key={a.atelier} className="flex border-b last:border-b-0">
                  <div className="w-56 shrink-0 border-r px-3 py-3">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm font-semibold">{a.atelier}</p>
                      {canCreate && (
                        <CreateOrderButton
                          ateliers={data.knownAteliers}
                          atelier={a.atelier}
                          label=""
                          className="h-6 w-6 justify-center rounded-md bg-transparent p-0 text-muted-foreground hover:bg-primary/10 hover:text-primary"
                        />
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {a.orders.length} OF · {formatNumber(a.chargePrevue)} prévus
                    </p>
                    {a.chargePrevue > 0 && (
                      <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-muted">
                        <div
                          className="h-full rounded-full bg-primary"
                          style={{
                            width: `${Math.min(100, (a.chargeRealisee / a.chargePrevue) * 100)}%`,
                          }}
                        />
                      </div>
                    )}
                  </div>

                  <div className="relative flex-1 py-2">
                    {/* Trame des jours */}
                    <div className="absolute inset-0 flex">
                      {data.days.map((d) => (
                        <div
                          key={d.label}
                          className={cn(
                            "flex-1 border-r last:border-r-0",
                            d.isWeekend && "bg-muted/40",
                            d.isToday && "bg-primary/5",
                          )}
                        />
                      ))}
                    </div>

                    {/* Créneaux cliquables : créer un OF sur cet atelier ce jour-là */}
                    {canCreate && (
                      <PlanningSlots
                        atelier={a.atelier}
                        days={clientDays}
                        ateliers={data.knownAteliers}
                      />
                    )}

                    {/* Barres des OF */}
                    <div className="pointer-events-none relative space-y-1.5 px-1 [&_a]:pointer-events-auto [&_button]:pointer-events-auto">
                      {a.orders.map((o) => (
                        <div key={o.id} className="group flex items-center">
                          <div
                            style={{
                              marginLeft: `${(o.startIndex / data.days.length) * 100}%`,
                              width: `${(o.span / data.days.length) * 100}%`,
                            }}
                          >
                            <Link
                              href={`/orders/${o.id}`}
                              title={`${o.number} — ${o.articleDesignation}\n${formatNumber(o.qteProduite)}/${formatNumber(o.qtePrevue)} · ${o.equipe ?? "—"} · priorité ${PRIORITE_LABEL[o.priorite]}`}
                              className={cn(
                                "block truncate rounded px-2 py-1 text-[11px] font-medium text-white transition-colors",
                                barTone(o.status, o.late),
                              )}
                            >
                              {o.late && <AlertTriangle className="mr-1 inline h-3 w-3" />}
                              {PRIORITE_MARK[o.priorite]}
                              {o.number} · {formatNumber(o.avancement, 0)} %
                            </Link>
                          </div>
                          {canPlan && (
                            <div className="ml-1 shrink-0 opacity-0 transition-opacity group-hover:opacity-100">
                              <PlanButton
                                target={toTarget(o)}
                                ateliers={data.knownAteliers}
                                variant="ghost"
                                size="icon"
                              />
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </Card>
      )}

      {/* Légende */}
      <div className="mt-3 flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded bg-primary/80" /> En production</span>
        <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded bg-warning/80" /> Production validée</span>
        <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded bg-success/80" /> Qualité validée</span>
        <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded bg-destructive/80" /> En retard</span>
      </div>

      {/* OF non planifiés */}
      {data.unplanned.length > 0 && (
        <Card className="mt-6">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <CalendarClock className="h-4 w-4 text-warning" />
              OF non planifiés ({data.unplanned.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="mb-3 text-sm text-muted-foreground">
              Ces ordres n'ont pas de date de début ou de fin prévue : ils n'apparaissent
              dans aucune charge d'atelier.
            </p>
            <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {data.unplanned.map((o) => (
                <li key={o.id} className="rounded-md border p-3">
                  <div className="flex items-center justify-between gap-2">
                    <Link href={`/orders/${o.id}`} className="font-medium text-primary hover:underline">
                      {o.number}
                    </Link>
                    <Badge variant={ORDER_STATUS[o.status].variant} className="text-[10px]">
                      {ORDER_STATUS[o.status].label}
                    </Badge>
                  </div>
                  <p className="mt-0.5 truncate text-xs text-muted-foreground">{o.articleDesignation}</p>
                  <p className="text-xs text-muted-foreground">
                    {o.atelier}
                    {o.suggestedAtelier && o.atelier === "Non affecté" && (
                      <span> · ligne ERP {o.suggestedAtelier}</span>
                    )}
                  </p>
                  {canPlan && (
                    <PlanButton
                      target={toTarget(o)}
                      ateliers={data.knownAteliers}
                      className="mt-2 w-full"
                    />
                  )}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
