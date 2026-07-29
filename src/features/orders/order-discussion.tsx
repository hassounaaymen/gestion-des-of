"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Send, Loader2, MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ROLE_LABELS } from "@/lib/rbac";
import { formatDateTime, cn } from "@/lib/utils";
import type { Role } from "@prisma/client";

interface CommentRow {
  id: string;
  content: string;
  createdAt: string;
  author: { fullName: string; role: Role };
}

/** Couleur par service, pour distinguer Production et Qualité d'un coup d'œil. */
const ROLE_TONE: Partial<Record<Role, string>> = {
  PRODUCTION: "border-l-primary",
  QUALITY: "border-l-success",
  PRODUCTION_MANAGER: "border-l-warning",
  DIRECTION: "border-l-destructive",
};

export function OrderDiscussion({
  orderId,
  currentUserId,
}: {
  orderId: string;
  currentUserId: string;
}) {
  const qc = useQueryClient();
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { data: comments = [], isLoading } = useQuery({
    queryKey: ["comments", orderId],
    queryFn: async () => {
      const res = await fetch(`/api/orders/${orderId}/comments`);
      if (!res.ok) throw new Error("Discussion indisponible");
      return res.json() as Promise<CommentRow[]>;
    },
  });

  async function send(e: React.FormEvent) {
    e.preventDefault();
    if (!text.trim()) return;
    setSending(true);
    setError(null);
    try {
      const res = await fetch(`/api/orders/${orderId}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: text.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Envoi impossible");
      setText("");
      qc.invalidateQueries({ queryKey: ["comments", orderId] });
      qc.invalidateQueries({ queryKey: ["notifications"] });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="space-y-4">
      {isLoading ? (
        <p className="py-4 text-center text-sm text-muted-foreground">Chargement…</p>
      ) : comments.length === 0 ? (
        <p className="flex items-center justify-center gap-2 py-6 text-sm text-muted-foreground">
          <MessageSquare className="h-4 w-4" />
          Aucun échange. Production et Qualité peuvent dialoguer ici, et la trace reste sur l'OF.
        </p>
      ) : (
        <ul className="space-y-3">
          {comments.map((c) => (
            <li
              key={c.id}
              className={cn(
                "rounded-md border border-l-4 bg-card p-3",
                ROLE_TONE[c.author.role] ?? "border-l-muted-foreground",
              )}
            >
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-medium">{c.author.fullName}</span>
                <Badge variant="secondary" className="text-[10px]">
                  {ROLE_LABELS[c.author.role]}
                </Badge>
                <span className="ml-auto text-xs text-muted-foreground">
                  {formatDateTime(c.createdAt)}
                </span>
              </div>
              <p className="mt-1.5 whitespace-pre-wrap text-sm">{c.content}</p>
            </li>
          ))}
        </ul>
      )}

      <form onSubmit={send} className="flex items-start gap-2">
        <textarea
          className="min-h-16 flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          placeholder="Écrire à l'autre service…"
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
        <Button type="submit" disabled={sending || !text.trim()}>
          {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          Envoyer
        </Button>
      </form>
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}
