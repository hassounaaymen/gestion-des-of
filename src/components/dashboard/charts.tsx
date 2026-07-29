"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  ComposedChart,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { DashboardData } from "@/services/dashboard.service";

const COLORS = ["#2563eb", "#16a34a", "#f59e0b", "#dc2626", "#7c3aed", "#0891b2"];
const AXIS = { fontSize: 12, fill: "hsl(var(--muted-foreground))" };

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent className="h-72">{children}</CardContent>
    </Card>
  );
}

export function DailyProductionChart({ data }: { data: DashboardData["dailyProduction"] }) {
  return (
    <ChartCard title="Production journalière (7 jours)">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} barGap={4}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
          <XAxis dataKey="day" tick={AXIS} axisLine={false} tickLine={false} />
          <YAxis tick={AXIS} axisLine={false} tickLine={false} />
          <Tooltip contentStyle={tooltipStyle} />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          <Bar dataKey="bonne" name="Qté bonne" fill="#16a34a" radius={[4, 4, 0, 0]} />
          <Bar dataKey="rebut" name="Qté rebut" fill="#dc2626" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}

export function TopArticlesChart({ data }: { data: DashboardData["topArticles"] }) {
  return (
    <ChartCard title="Top articles produits">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ left: 20 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" horizontal={false} />
          <XAxis type="number" tick={AXIS} axisLine={false} tickLine={false} />
          <YAxis type="category" dataKey="name" tick={AXIS} width={120} axisLine={false} tickLine={false} />
          <Tooltip contentStyle={tooltipStyle} />
          <Bar dataKey="value" name="Qté bonne" fill="#2563eb" radius={[0, 4, 4, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}

export function TopRejectsChart({ data }: { data: DashboardData["topRejects"] }) {
  return (
    <ChartCard title="Top articles rebutés">
      {data.length === 0 ? (
        <EmptyChart />
      ) : (
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} layout="vertical" margin={{ left: 20 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" horizontal={false} />
            <XAxis type="number" tick={AXIS} axisLine={false} tickLine={false} />
            <YAxis type="category" dataKey="name" tick={AXIS} width={120} axisLine={false} tickLine={false} />
            <Tooltip contentStyle={tooltipStyle} />
            <Bar dataKey="value" name="Qté rebut" fill="#dc2626" radius={[0, 4, 4, 0]} />
          </BarChart>
        </ResponsiveContainer>
      )}
    </ChartCard>
  );
}

export function DefectParetoChart({ data }: { data: DashboardData["defectPareto"] }) {
  let cumulative = 0;
  const total = data.reduce((s, d) => s + d.value, 0) || 1;
  const withCumul = data.map((d) => {
    cumulative += d.value;
    return { ...d, cumul: Math.round((cumulative / total) * 100) };
  });
  return (
    <ChartCard title="Pareto des défauts">
      {data.length === 0 ? (
        <EmptyChart />
      ) : (
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={withCumul}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
            <XAxis dataKey="cause" tick={AXIS} axisLine={false} tickLine={false} interval={0} height={50} />
            <YAxis yAxisId="left" tick={AXIS} axisLine={false} tickLine={false} />
            <YAxis yAxisId="right" orientation="right" tick={AXIS} axisLine={false} tickLine={false} unit="%" />
            <Tooltip contentStyle={tooltipStyle} />
            <Bar yAxisId="left" dataKey="value" name="Rebuts" fill="#f59e0b" radius={[4, 4, 0, 0]} />
            <Line yAxisId="right" type="monotone" dataKey="cumul" name="Cumul %" stroke="#dc2626" strokeWidth={2} />
          </ComposedChart>
        </ResponsiveContainer>
      )}
    </ChartCard>
  );
}

export function M5Chart({ data }: { data: DashboardData["defectByM5"] }) {
  return (
    <ChartCard title="Rebuts par axe 5M (Ishikawa)">
      {data.length === 0 ? (
        <EmptyChart />
      ) : (
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} layout="vertical" margin={{ left: 20 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" horizontal={false} />
            <XAxis type="number" tick={AXIS} axisLine={false} tickLine={false} />
            <YAxis type="category" dataKey="name" tick={AXIS} width={110} axisLine={false} tickLine={false} />
            <Tooltip contentStyle={tooltipStyle} />
            <Bar dataKey="value" name="Qté rebut" radius={[0, 4, 4, 0]}>
              {data.map((_, i) => (
                <Cell key={i} fill={COLORS[i % COLORS.length]} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      )}
    </ChartCard>
  );
}

export function QualityPieChart({ data }: { data: DashboardData["qualityBreakdown"] }) {
  return (
    <ChartCard title="Répartition des décisions qualité">
      {data.length === 0 ? (
        <EmptyChart />
      ) : (
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={data} dataKey="value" nameKey="name" innerRadius={55} outerRadius={90} paddingAngle={3}>
              {data.map((_, i) => (
                <Cell key={i} fill={COLORS[i % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip contentStyle={tooltipStyle} />
            <Legend wrapperStyle={{ fontSize: 12 }} />
          </PieChart>
        </ResponsiveContainer>
      )}
    </ChartCard>
  );
}

function EmptyChart() {
  return (
    <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
      Aucune donnée disponible
    </div>
  );
}

const tooltipStyle = {
  backgroundColor: "hsl(var(--card))",
  border: "1px solid hsl(var(--border))",
  borderRadius: 8,
  fontSize: 12,
  color: "hsl(var(--foreground))",
};
