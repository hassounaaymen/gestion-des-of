"use client";

import { motion } from "framer-motion";
import {
  Activity,
  CheckCircle2,
  Factory,
  PackageCheck,
  Trash2,
  Percent,
  Gauge,
  AlertTriangle,
  Scale,
  GitCompareArrows,
  type LucideIcon,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

// Les composants (fonctions) ne peuvent pas franchir la frontière serveur→client :
// on résout l'icône par son nom côté client.
const ICONS = {
  Activity,
  CheckCircle2,
  Factory,
  PackageCheck,
  Trash2,
  Percent,
  Gauge,
  AlertTriangle,
  Scale,
  GitCompareArrows,
} satisfies Record<string, LucideIcon>;

export type KpiIcon = keyof typeof ICONS;

interface KpiCardProps {
  label: string;
  value: string;
  icon: KpiIcon;
  hint?: string;
  tone?: "default" | "success" | "warning" | "destructive";
  index?: number;
}

const TONES = {
  default: "bg-primary/10 text-primary",
  success: "bg-success/15 text-success",
  warning: "bg-warning/15 text-warning",
  destructive: "bg-destructive/15 text-destructive",
};

export function KpiCard({
  label,
  value,
  icon,
  hint,
  tone = "default",
  index = 0,
}: KpiCardProps) {
  const Icon = ICONS[icon];
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: index * 0.05 }}
    >
      <Card className="p-5">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <p className="text-sm font-medium text-muted-foreground">{label}</p>
            <p className="text-2xl font-bold tracking-tight">{value}</p>
            {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
          </div>
          <div className={cn("flex h-11 w-11 items-center justify-center rounded-lg", TONES[tone])}>
            <Icon className="h-5 w-5" />
          </div>
        </div>
      </Card>
    </motion.div>
  );
}
