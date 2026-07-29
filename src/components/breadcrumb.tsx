"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronRight, Home } from "lucide-react";
import { Fragment } from "react";

const LABELS: Record<string, string> = {
  dashboard: "Tableau de bord",
  planning: "Planning de production",
  reports: "Rapports & exports",
  orders: "Ordres de fabrication",
  production: "Saisie production",
  quality: "Contrôle qualité",
  ecarts: "Écarts Production / Qualité",
  "non-conformities": "Non-conformités",
  articles: "Articles",
  stores: "Magasins",
  audit: "Historique",
  users: "Utilisateurs",
  new: "Nouveau",
};

export function Breadcrumb() {
  const pathname = usePathname();
  const segments = pathname.split("/").filter(Boolean);

  return (
    <nav className="flex items-center gap-1.5 text-sm text-muted-foreground">
      <Link href="/dashboard" className="hover:text-foreground">
        <Home className="h-4 w-4" />
      </Link>
      {segments.map((seg, i) => {
        const href = "/" + segments.slice(0, i + 1).join("/");
        const isLast = i === segments.length - 1;
        const label = LABELS[seg] ?? seg;
        return (
          <Fragment key={href}>
            <ChevronRight className="h-3.5 w-3.5" />
            {isLast ? (
              <span className="font-medium text-foreground">{label}</span>
            ) : (
              <Link href={href} className="hover:text-foreground">
                {label}
              </Link>
            )}
          </Fragment>
        );
      })}
    </nav>
  );
}
