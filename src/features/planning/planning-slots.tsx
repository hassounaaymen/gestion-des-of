"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { CreateOrderDialog } from "./create-order-dialog";
import { cn } from "@/lib/utils";

/**
 * Couche de créneaux cliquables posée sur la trame du Gantt.
 * Un clic sur une case (atelier × jour) ouvre la création d'OF pré-remplie.
 * Elle reste sous les barres d'OF pour ne pas gêner leur consultation.
 */
export function PlanningSlots({
  atelier,
  days,
  ateliers,
}: {
  atelier: string;
  /** Jours de l'horizon, en ISO */
  days: { iso: string; label: string; isWeekend: boolean }[];
  ateliers: string[];
}) {
  const [open, setOpen] = useState(false);
  const [day, setDay] = useState<string | null>(null);

  return (
    <>
      <div className="absolute inset-0 flex">
        {days.map((d) => (
          <button
            key={d.iso}
            type="button"
            title={`Créer un OF — ${atelier} le ${d.label}`}
            onClick={() => {
              setDay(d.iso);
              setOpen(true);
            }}
            className={cn(
              "group/slot flex flex-1 items-start justify-center border-r pt-1 transition-colors last:border-r-0",
              "hover:bg-primary/10",
            )}
          >
            <Plus className="h-3.5 w-3.5 text-primary opacity-0 transition-opacity group-hover/slot:opacity-100" />
          </button>
        ))}
      </div>

      <CreateOrderDialog
        open={open}
        onOpenChange={setOpen}
        atelier={atelier}
        day={day}
        ateliers={ateliers}
      />
    </>
  );
}

/** Bouton simple de création, sans créneau pré-sélectionné. */
export function CreateOrderButton({
  ateliers,
  atelier,
  className,
  label = "Nouvel OF",
}: {
  ateliers: string[];
  atelier?: string;
  className?: string;
  label?: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={cn(
          "inline-flex h-9 items-center gap-2 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90",
          className,
        )}
      >
        <Plus className="h-4 w-4" />
        {label}
      </button>
      <CreateOrderDialog
        open={open}
        onOpenChange={setOpen}
        atelier={atelier}
        day={null}
        ateliers={ateliers}
      />
    </>
  );
}
