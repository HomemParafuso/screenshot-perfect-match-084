import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Activity, CreditCard, Smartphone, Users } from "lucide-react";
import { Loading, PageHeader } from "@/components/admin/shell";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { api } from "@/lib/api";
import { formatMoney, formatNumber } from "@/lib/format";

export const Route = createFileRoute("/_app/")({
  component: Dashboard,
});

type Stats = {
  users: { total: number; active: number; suspended: number; last_30_days: number };
  subscriptions: Record<string, number>;
  mrrCents: number;
  devices: { total: number; active: number };
  remoteSessions: { total: number; running: number };
  tokensLast30Days: string | number;
};

function StatCard({
  title,
  value,
  hint,
  icon: Icon,
}: {
  title: string;
  value: string;
  hint?: string;
  icon: typeof Users;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <Icon className="size-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <p className="text-2xl font-semibold">{value}</p>
        {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
      </CardContent>
    </Card>
  );
}

function Dashboard() {
  const { data, isLoading, error } = useQuery({
    queryKey: ["admin-stats"],
    queryFn: () => api<Stats>("/admin/stats"),
  });

  if (isLoading) return <Loading />;
  if (error || !data)
    return <p className="text-sm text-destructive">Não foi possível carregar as estatísticas.</p>;

  const subs = data.subscriptions;
  const totalSubs = Object.values(subs).reduce((a, b) => a + b, 0);

  return (
    <div>
      <PageHeader title="Dashboard" description="Visão geral do HASi Control Plane" />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          title="Usuários"
          value={formatNumber(data.users.total)}
          hint={`${formatNumber(data.users.active)} ativos · ${formatNumber(data.users.last_30_days)} novos em 30 dias`}
          icon={Users}
        />
        <StatCard
          title="Assinaturas"
          value={formatNumber(totalSubs)}
          hint={`${formatNumber(subs["active"] ?? 0)} ativa(s) · ${formatNumber(subs["trial"] ?? 0)} em trial`}
          icon={CreditCard}
        />
        <StatCard
          title="MRR"
          value={formatMoney(data.mrrCents)}
          hint="Planos ativos e em trial"
          icon={Activity}
        />
        <StatCard
          title="Dispositivos"
          value={formatNumber(data.devices.active)}
          hint={`${formatNumber(data.devices.total)} no total`}
          icon={Smartphone}
        />
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Assinaturas por estado</CardTitle>
            <CardDescription>Distribuição atual</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            {["trial", "active", "past_due", "canceled", "suspended"].map((status) => (
              <Badge key={status} variant={status === "active" ? "default" : "secondary"}>
                {status}: {formatNumber(subs[status] ?? 0)}
              </Badge>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Uso remoto (30 dias)</CardTitle>
            <CardDescription>Tokens registrados, sem cobrança nesta versão</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Tokens</span>
              <span className="font-medium">{formatNumber(data.tokensLast30Days)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Sessões remotas</span>
              <span className="font-medium">{formatNumber(data.remoteSessions.total)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Em execução</span>
              <span className="font-medium">{formatNumber(data.remoteSessions.running)}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="mt-6 flex flex-wrap gap-2 text-sm">
        <Link to="/users" className="text-primary underline-offset-4 hover:underline">
          Gerenciar usuários
        </Link>
        <span className="text-muted-foreground">·</span>
        <Link to="/plans" className="text-primary underline-offset-4 hover:underline">
          Configurar planos
        </Link>
        <span className="text-muted-foreground">·</span>
        <Link to="/audit" className="text-primary underline-offset-4 hover:underline">
          Ver auditoria
        </Link>
      </div>
    </div>
  );
}
