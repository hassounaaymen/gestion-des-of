import { Check, Circle } from "lucide-react";
import type { OrderStatus } from "@prisma/client";
import { cn } from "@/lib/utils";

const STEPS: { status: OrderStatus; label: string }[] = [
  { status: "IN_PRODUCTION", label: "Production" },
  { status: "PRODUCTION_VALIDATED", label: "Validation Production" },
  { status: "QUALITY_VALIDATED", label: "Validation Qualité" },
  { status: "CLOSED", label: "Clôture OF" },
];

const ORDER_INDEX: Record<OrderStatus, number> = {
  DRAFT: 0,
  IN_PRODUCTION: 0,
  PRODUCTION_VALIDATED: 1,
  QUALITY_VALIDATED: 2,
  CLOSED: 3,
  CANCELLED: -1,
};

export function WorkflowTimeline({ status }: { status: OrderStatus }) {
  const current = ORDER_INDEX[status];
  return (
    <div className="flex items-center">
      {STEPS.map((step, i) => {
        const done = i < current || status === "CLOSED";
        const active = i === current && status !== "CLOSED";
        return (
          <div key={step.status} className="flex flex-1 items-center last:flex-none">
            <div className="flex flex-col items-center gap-1.5">
              <div
                className={cn(
                  "flex h-8 w-8 items-center justify-center rounded-full border-2 transition-colors",
                  done && "border-success bg-success text-success-foreground",
                  active && "border-primary bg-primary text-primary-foreground",
                  !done && !active && "border-muted-foreground/30 text-muted-foreground",
                )}
              >
                {done ? <Check className="h-4 w-4" /> : <Circle className="h-2.5 w-2.5 fill-current" />}
              </div>
              <span
                className={cn(
                  "whitespace-nowrap text-xs font-medium",
                  done || active ? "text-foreground" : "text-muted-foreground",
                )}
              >
                {step.label}
              </span>
            </div>
            {i < STEPS.length - 1 && (
              <div
                className={cn(
                  "mx-2 mb-5 h-0.5 flex-1 rounded",
                  i < current ? "bg-success" : "bg-muted-foreground/20",
                )}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
