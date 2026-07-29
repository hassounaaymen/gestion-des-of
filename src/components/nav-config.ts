import {
  LayoutDashboard,
  CalendarRange,
  FileDown,
  ClipboardList,
  Factory,
  ShieldCheck,
  AlertTriangle,
  Package,
  Scale,
  Warehouse,
  History,
  Users,
  type LucideIcon,
} from "lucide-react";
import type { Permission } from "@/lib/rbac";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  permission?: Permission;
  group: string;
}

export const NAV_ITEMS: NavItem[] = [
  { href: "/dashboard", label: "Tableau de bord", icon: LayoutDashboard, group: "Pilotage" },
  { href: "/reports", label: "Rapports & exports", icon: FileDown, permission: "report:read", group: "Pilotage" },
  { href: "/planning", label: "Planning de production", icon: CalendarRange, permission: "planning:read", group: "Production" },
  { href: "/orders", label: "Ordres de fabrication", icon: ClipboardList, permission: "order:read", group: "Production" },
  { href: "/production", label: "Saisie production", icon: Factory, permission: "production:read", group: "Production" },
  { href: "/quality", label: "Contrôle qualité", icon: ShieldCheck, permission: "quality:read", group: "Qualité" },
  { href: "/ecarts", label: "Écarts Prod. / Qualité", icon: Scale, permission: "quality:read", group: "Qualité" },
  { href: "/non-conformities", label: "Non-conformités", icon: AlertTriangle, permission: "nc:read", group: "Qualité" },
  { href: "/articles", label: "Articles (ERP)", icon: Package, permission: "erp:read", group: "Référentiel" },
  { href: "/stores", label: "Magasins (ERP)", icon: Warehouse, permission: "erp:read", group: "Référentiel" },
  { href: "/audit", label: "Historique", icon: History, permission: "audit:read", group: "Administration" },
  { href: "/users", label: "Utilisateurs", icon: Users, permission: "user:manage", group: "Administration" },
];
