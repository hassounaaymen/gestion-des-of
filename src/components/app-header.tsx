"use client";

import { useRouter } from "next/navigation";
import { LogOut, User as UserIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ThemeToggle } from "./theme-toggle";
import { Breadcrumb } from "./breadcrumb";
import { NotificationBell } from "./notification-bell";
import { ROLE_LABELS } from "@/lib/rbac";
import type { Role } from "@prisma/client";

export function AppHeader({
  fullName,
  role,
}: {
  fullName: string;
  role: Role;
}) {
  const router = useRouter();

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.replace("/login");
    router.refresh();
  }

  return (
    <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b bg-background/80 px-6 backdrop-blur">
      <Breadcrumb />
      <div className="flex items-center gap-3">
        <NotificationBell />
        <ThemeToggle />
        <div className="hidden items-center gap-2 rounded-full border bg-card py-1 pl-1 pr-3 sm:flex">
          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 text-primary">
            <UserIcon className="h-4 w-4" />
          </div>
          <div className="leading-tight">
            <p className="text-xs font-medium">{fullName}</p>
            <Badge variant="secondary" className="h-4 px-1.5 text-[10px]">
              {ROLE_LABELS[role]}
            </Badge>
          </div>
        </div>
        <Button variant="ghost" size="icon" aria-label="Se déconnecter" onClick={logout}>
          <LogOut className="h-4 w-4" />
        </Button>
      </div>
    </header>
  );
}
