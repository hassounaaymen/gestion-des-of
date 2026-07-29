"use client";

import { useState } from "react";
import { CalendarClock, CalendarCog } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PlanOrderDialog, type PlanTarget } from "./plan-order-dialog";
import { cn } from "@/lib/utils";

/**
 * Bouton de (re)planification. Rendu côté client pour porter la boîte de dialogue,
 * mais alimenté par les données déjà chargées côté serveur.
 */
export function PlanButton({
  target,
  ateliers,
  variant = "default",
  size = "sm",
  label,
  className,
}: {
  target: PlanTarget;
  ateliers: string[];
  variant?: "default" | "outline" | "ghost";
  size?: "sm" | "default" | "icon";
  label?: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const isPlanned = Boolean(target.dateDebut && target.dateFinPrev);
  const Icon = isPlanned ? CalendarCog : CalendarClock;

  return (
    <>
      <Button
        variant={variant}
        size={size}
        className={cn(className)}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setOpen(true);
        }}
      >
        <Icon className="h-4 w-4" />
        {size !== "icon" && (label ?? (isPlanned ? "Replanifier" : "Planifier"))}
      </Button>

      <PlanOrderDialog
        target={target}
        ateliers={ateliers}
        open={open}
        onOpenChange={setOpen}
      />
    </>
  );
}
