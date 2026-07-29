"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell, CheckCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface Notif {
  id: string;
  type: string;
  title: string;
  message: string;
  link: string | null;
  isRead: boolean;
  createdAt: string;
}

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return "à l'instant";
  if (min < 60) return `il y a ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `il y a ${h} h`;
  return `il y a ${Math.floor(h / 24)} j`;
}

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const qc = useQueryClient();

  const { data } = useQuery({
    queryKey: ["notifications"],
    queryFn: async () => {
      const res = await fetch("/api/notifications");
      if (!res.ok) throw new Error("Notifications indisponibles");
      return res.json() as Promise<{ items: Notif[]; unread: number }>;
    },
    refetchInterval: 60_000,
  });

  const unread = data?.unread ?? 0;

  async function markAll() {
    await fetch("/api/notifications", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    qc.invalidateQueries({ queryKey: ["notifications"] });
  }

  return (
    <div className="relative">
      <Button
        variant="ghost"
        size="icon"
        aria-label={`Notifications${unread > 0 ? ` (${unread} non lues)` : ""}`}
        onClick={() => setOpen((v) => !v)}
      >
        <Bell className="h-4 w-4" />
        {unread > 0 && (
          <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold text-destructive-foreground">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </Button>

      {open && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />
          <div className="absolute right-0 z-40 mt-2 w-80 overflow-hidden rounded-lg border bg-popover shadow-lg">
            <div className="flex items-center justify-between border-b px-3 py-2">
              <span className="text-sm font-semibold">Notifications</span>
              {unread > 0 && (
                <button
                  onClick={markAll}
                  className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                >
                  <CheckCheck className="h-3 w-3" /> Tout marquer lu
                </button>
              )}
            </div>
            <ul className="max-h-96 overflow-y-auto">
              {(data?.items.length ?? 0) === 0 && (
                <li className="px-3 py-8 text-center text-sm text-muted-foreground">
                  Aucune notification
                </li>
              )}
              {data?.items.map((n) => {
                const body = (
                  <div
                    className={cn(
                      "border-b px-3 py-2.5 text-sm transition-colors hover:bg-accent/50",
                      !n.isRead && "bg-accent/30",
                    )}
                  >
                    <div className="flex items-start gap-2">
                      {!n.isRead && <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />}
                      <div className={cn("min-w-0", n.isRead && "pl-3.5")}>
                        <p className="font-medium">{n.title}</p>
                        <p className="truncate text-xs text-muted-foreground">{n.message}</p>
                        <p className="mt-0.5 text-[11px] text-muted-foreground">{timeAgo(n.createdAt)}</p>
                      </div>
                    </div>
                  </div>
                );
                return (
                  <li key={n.id}>
                    {n.link ? (
                      <Link href={n.link} onClick={() => setOpen(false)}>
                        {body}
                      </Link>
                    ) : (
                      body
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        </>
      )}
    </div>
  );
}
