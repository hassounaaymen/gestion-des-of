import { notFound, redirect } from "next/navigation";
import { FileText } from "lucide-react";
import { getSession } from "@/lib/session";
import { can } from "@/lib/rbac";
import { orderService } from "@/services/order.service";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { WorkflowTimeline } from "@/features/orders/workflow-timeline";
import { ProductionPanel } from "@/features/orders/production-panel";
import { QualityPanel } from "@/features/orders/quality-panel";
import { OrderActions } from "@/features/orders/order-actions";
import { OrderDiscussion } from "@/features/orders/order-discussion";
import { PlanButton } from "@/features/planning/plan-button";
import { prisma } from "@/lib/prisma";
import { ORDER_STATUS } from "@/lib/status";
import { formatDate, formatDateTime } from "@/lib/utils";

export const dynamic = "force-dynamic";

const PRIORITE_LABEL: Record<string, string> = {
  BASSE: "Basse",
  NORMALE: "Normale",
  HAUTE: "Haute",
  URGENTE: "Urgente",
};

const PRIORITE_VARIANT: Record<string, "secondary" | "default" | "warning" | "destructive"> = {
  BASSE: "secondary",
  NORMALE: "default",
  HAUTE: "warning",
  URGENTE: "destructive",
};

export default async function OrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getSession();
  if (!session) redirect("/login");
  const { id } = await params;
  const order = await orderService.get(id);
  if (!order) notFound();

  // Auto-complétion des ateliers : lignes ERP + ateliers déjà utilisés
  const [usedAteliers, erpLines] = await Promise.all([
    prisma.productionOrder.findMany({
      where: { atelier: { not: null } },
      distinct: ["atelier"],
      select: { atelier: true },
    }),
    prisma.article.findMany({
      where: { productionLine: { not: null }, isManufactured: true },
      distinct: ["productionLine"],
      select: { productionLine: true },
    }),
  ]);
  const knownAteliers = Array.from(
    new Set(
      [...usedAteliers.map((a) => a.atelier), ...erpLines.map((l) => l.productionLine)].filter(
        (x): x is string => Boolean(x?.trim()),
      ),
    ),
  ).sort();

  const st = ORDER_STATUS[order.status];
  const line = order.productionLines[0];
  const quality = order.qualityControls[0];

  const prodEditable = can(session.role, "production:write");
  const qualEditable = can(session.role, "quality:write");
  const prodLocked = order.status !== "IN_PRODUCTION" && order.status !== "DRAFT";
  const qualLocked = order.status === "QUALITY_VALIDATED" || order.status === "CLOSED";
  const qualityAvailable = prodLocked; // qualité seulement après validation production

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight">{order.number}</h1>
            <Badge variant={st.variant}>{st.label}</Badge>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            <span>{order.article.designation}</span>
            <span className="font-mono">{order.article.code}</span>
            {order.article.family && <Badge variant="secondary">{order.article.family}</Badge>}
            {order.article.productionLine && (
              <Badge variant="default">Ligne {order.article.productionLine}</Badge>
            )}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {can(session.role, "planning:write") &&
            order.status !== "CLOSED" &&
            order.status !== "CANCELLED" && (
              <PlanButton
                variant="outline"
                size="default"
                ateliers={knownAteliers}
                target={{
                  id: order.id,
                  number: order.number,
                  articleDesignation: order.article.designation,
                  dateDebut: order.dateDebut ? order.dateDebut.toISOString() : null,
                  dateFinPrev: order.dateFinPrev ? order.dateFinPrev.toISOString() : null,
                  atelier: order.atelier,
                  equipe: order.equipe,
                  chefEquipe: order.chefEquipe,
                  priorite: order.priorite,
                  suggestedAtelier: order.article.productionLine,
                }}
              />
            )}
          {can(session.role, "report:export") && (
            <a
              href={`/api/export/pdf?type=order&id=${order.id}`}
              className="inline-flex h-9 items-center gap-2 rounded-md border border-input bg-background px-4 text-sm font-medium transition-colors hover:bg-accent"
            >
              <FileText className="h-4 w-4" />
              Fiche PDF
            </a>
          )}
        <OrderActions
          orderId={order.id}
          status={order.status}
          perms={{
            validateProduction: can(session.role, "order:validateProduction"),
            validateQuality: can(session.role, "order:validateQuality"),
            close: can(session.role, "order:close"),
          }}
        />
        </div>
      </div>

      <Card>
        <CardContent className="pt-6">
          <WorkflowTimeline status={order.status} />
        </CardContent>
      </Card>

      {/* Informations générales */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Informations générales</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-3 lg:grid-cols-4">
          <Info label="Magasin" value={`${order.store.designation} (${order.store.code})`} />
          <Info label="Atelier" value={order.atelier} />
          <Info label="Équipe" value={order.equipe} />
          <Info label="Chef d'équipe" value={order.chefEquipe} />
          <Info label="Date début" value={formatDate(order.dateDebut)} />
          <Info label="Date fin prévue" value={formatDate(order.dateFinPrev)} />
          <div>
            <p className="text-xs text-muted-foreground">Priorité</p>
            <Badge variant={PRIORITE_VARIANT[order.priorite]} className="mt-0.5">
              {PRIORITE_LABEL[order.priorite]}
            </Badge>
          </div>
          {order.plannedBy && (
            <Info
              label="Planifié par"
              value={`${order.plannedBy} · ${formatDateTime(order.plannedAt)}`}
            />
          )}
          <Info label="Créé par" value={order.createdBy.fullName} />
          <Info label="Créé le" value={formatDateTime(order.createdAt)} />
          {order.productionValidatedBy && (
            <Info label="Production validée par" value={`${order.productionValidatedBy} · ${formatDateTime(order.productionValidatedAt)}`} />
          )}
          {order.qualityValidatedBy && (
            <Info label="Qualité validée par" value={`${order.qualityValidatedBy} · ${formatDateTime(order.qualityValidatedAt)}`} />
          )}
          {order.closedBy && (
            <Info label="Clôturé par" value={`${order.closedBy} · ${formatDateTime(order.closedAt)}`} />
          )}
        </CardContent>
      </Card>

      {/* Saisie production */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Saisie production</CardTitle>
        </CardHeader>
        <CardContent>
          <ProductionPanel
            orderId={order.id}
            editable={prodEditable}
            locked={prodLocked}
            unit={order.article.unit}
            initial={{
              qtePrevue: line?.qtePrevue ?? 0,
              qteProduite: line?.qteProduite ?? 0,
              qteBonne: line?.qteBonne ?? 0,
              qteRebut: line?.qteRebut ?? 0,
              causeRebut: line?.causeRebut ?? null,
              causeRebutCode: line?.causeRebutCode ?? null,
              causeRebutM5: line?.causeRebutM5 ?? null,
              tempsMachine: line?.tempsMachine ?? null,
              tempsOperateur: line?.tempsOperateur ?? null,
              commentaires: line?.commentaires ?? null,
            }}
          />
        </CardContent>
      </Card>

      {/* Contrôle qualité */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Contrôle qualité</CardTitle>
        </CardHeader>
        <CardContent>
          {qualityAvailable ? (
            <QualityPanel
              orderId={order.id}
              editable={qualEditable}
              locked={qualLocked}
              unit={order.article.unit}
              production={{
                qteProduite: line?.qteProduite ?? 0,
                qteBonne: line?.qteBonne ?? 0,
                qteRebut: line?.qteRebut ?? 0,
              }}
              initial={{
                controleur: quality?.controleur ?? session.fullName,
                // Sans contrôle existant, on part de ce que la Production a déclaré
                qteControlee: quality ? quality.qteControlee : (line?.qteProduite ?? 0),
                qteConforme: quality ? quality.qteConforme : (line?.qteProduite ?? 0),
                qteNonConforme: quality ? quality.qteNonConforme : 0,
                longueur: quality?.longueur ?? null,
                largeur: quality?.largeur ?? null,
                hauteur: quality?.hauteur ?? null,
                poids: quality?.poids ?? null,
                resistance: quality?.resistance ?? null,
                aspect: quality?.aspect ?? null,
                couleur: quality?.couleur ?? null,
                humidite: quality?.humidite ?? null,
                commentaires: quality?.commentaires ?? null,
                decision: quality?.decision ?? "EN_ATTENTE",
              }}
            />
          ) : (
            <p className="py-6 text-center text-sm text-muted-foreground">
              Le contrôle qualité sera disponible une fois la production validée.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Communication Production ↔ Qualité */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Échanges Production ↔ Qualité</CardTitle>
        </CardHeader>
        <CardContent>
          <OrderDiscussion orderId={order.id} currentUserId={session.sub} />
        </CardContent>
      </Card>

      {/* Non-conformités liées */}
      {order.nonConformities.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Non-conformités</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {order.nonConformities.map((nc) => (
              <div key={nc.id} className="flex items-center justify-between rounded-md border px-3 py-2 text-sm">
                <span className="font-medium">{nc.number}</span>
                <span className="text-muted-foreground">{nc.nature}</span>
                <Badge variant="destructive">{nc.gravite}</Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function Info({ label, value }: { label: string; value?: string | null }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="font-medium">{value || "—"}</p>
    </div>
  );
}
