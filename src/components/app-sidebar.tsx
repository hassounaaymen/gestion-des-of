"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Factory } from "lucide-react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { NAV_ITEMS } from "./nav-config";
import { can, type Permission } from "@/lib/rbac";
import type { Role } from "@prisma/client";

export function AppSidebar({ role }: { role: Role }) {
  const pathname = usePathname();

  const visible = NAV_ITEMS.filter(
    (i) => !i.permission || can(role, i.permission as Permission),
  );
  const groups = Array.from(new Set(visible.map((i) => i.group)));

  return (
    <aside className="hidden w-64 shrink-0 flex-col border-r bg-card md:flex">
      <div className="flex h-16 items-center gap-2.5 border-b px-5">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
          <Factory className="h-5 w-5" />
        </div>
        <div className="leading-tight">
          <p className="text-sm font-semibold">Gestion des OF</p>
          <p className="text-[11px] text-muted-foreground">Béton Préfabriqué</p>
        </div>
      </div>

      <nav className="flex-1 space-y-6 overflow-y-auto p-3">
        {groups.map((group) => (
          <div key={group}>
            <p className="px-3 pb-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              {group}
            </p>
            <ul className="space-y-0.5">
              {visible
                .filter((i) => i.group === group)
                .map((item) => {
                  const active =
                    pathname === item.href || pathname.startsWith(item.href + "/");
                  const Icon = item.icon;
                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        className={cn(
                          "relative flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                          active
                            ? "bg-accent text-accent-foreground"
                            : "text-muted-foreground hover:bg-accent/50 hover:text-foreground",
                        )}
                      >
                        {active && (
                          <motion.span
                            layoutId="sidebar-active"
                            className="absolute left-0 top-1.5 h-[calc(100%-12px)] w-1 rounded-full bg-primary"
                          />
                        )}
                        <Icon className="h-4 w-4" />
                        {item.label}
                      </Link>
                    </li>
                  );
                })}
            </ul>
          </div>
        ))}
      </nav>
    </aside>
  );
}
