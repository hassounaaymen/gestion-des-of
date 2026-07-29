import { Lock } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/page-header";
import { ArticlesBrowser } from "@/features/erp/articles-browser";
import { SyncErpButton } from "@/features/erp/sync-button";
import { getSession } from "@/lib/session";
import { can } from "@/lib/rbac";

export const dynamic = "force-dynamic";

export default async function ArticlesPage() {
  const [families, lines, session, total] = await Promise.all([
    prisma.article.findMany({
      where: { family: { not: null } },
      distinct: ["family"],
      select: { family: true },
      orderBy: { family: "asc" },
    }),
    prisma.article.findMany({
      where: { productionLine: { not: null } },
      distinct: ["productionLine"],
      select: { productionLine: true },
      orderBy: { productionLine: "asc" },
    }),
    getSession(),
    prisma.article.count(),
  ]);
  const canSync = session && can(session.role, "erp:sync");

  return (
    <div>
      <PageHeader
        title="Articles (ERP)"
        description={`${total} références synchronisées depuis Microsoft Dynamics — lecture seule`}
        action={canSync ? <SyncErpButton /> : undefined}
      />
      <div className="mb-4 flex items-center gap-2 rounded-md border bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
        <Lock className="h-4 w-4" />
        Ces informations proviennent uniquement de l'ERP et ne sont pas modifiables dans l'application.
      </div>
      <ArticlesBrowser
        families={families.map((f) => f.family!).filter(Boolean)}
        lines={lines.map((l) => l.productionLine!).filter(Boolean)}
      />
    </div>
  );
}
